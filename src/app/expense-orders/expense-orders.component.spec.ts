import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExpenseOrdersComponent } from './expense-orders.component';

describe('ExpenseOrdersComponent', () => {
  let component: ExpenseOrdersComponent;
  let fixture: ComponentFixture<ExpenseOrdersComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ExpenseOrdersComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ExpenseOrdersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
