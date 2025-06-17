import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LeadsReportsComponent } from './leads-reports.component';

describe('LeadsReportsComponent', () => {
  let component: LeadsReportsComponent;
  let fixture: ComponentFixture<LeadsReportsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [LeadsReportsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LeadsReportsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
