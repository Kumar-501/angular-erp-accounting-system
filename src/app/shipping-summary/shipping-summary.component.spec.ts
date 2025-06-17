import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ShippingSummaryComponent } from './shipping-summary.component';

describe('ShippingSummaryComponent', () => {
  let component: ShippingSummaryComponent;
  let fixture: ComponentFixture<ShippingSummaryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ShippingSummaryComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ShippingSummaryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
