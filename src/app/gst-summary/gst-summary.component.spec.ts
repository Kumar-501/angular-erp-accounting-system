import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GstSummaryComponent } from './gst-summary.component';

describe('GstSummaryComponent', () => {
  let component: GstSummaryComponent;
  let fixture: ComponentFixture<GstSummaryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [GstSummaryComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GstSummaryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
