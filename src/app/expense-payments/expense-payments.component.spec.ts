import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExpensePaymentsComponent } from './expense-payments.component';

describe('ExpensePaymentsComponent', () => {
  let component: ExpensePaymentsComponent;
  let fixture: ComponentFixture<ExpensePaymentsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ExpensePaymentsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ExpensePaymentsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
