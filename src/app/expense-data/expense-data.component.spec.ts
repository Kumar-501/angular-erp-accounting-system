import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExpenseDataComponent } from './expense-data.component';

describe('ExpenseDataComponent', () => {
  let component: ExpenseDataComponent;
  let fixture: ComponentFixture<ExpenseDataComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ExpenseDataComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ExpenseDataComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
