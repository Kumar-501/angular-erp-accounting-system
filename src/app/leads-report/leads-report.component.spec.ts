import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LeadsReportComponent } from './leads-report.component';

describe('LeadsReportComponent', () => {
  let component: LeadsReportComponent;
  let fixture: ComponentFixture<LeadsReportComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [LeadsReportComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LeadsReportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
