import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PaycashDetailsComponent } from './paycash-details.component';

describe('PaycashDetailsComponent', () => {
  let component: PaycashDetailsComponent;
  let fixture: ComponentFixture<PaycashDetailsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PaycashDetailsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PaycashDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
