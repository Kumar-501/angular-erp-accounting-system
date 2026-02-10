import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BalanceSheet2Component } from './balance-sheet-2.component';

describe('BalanceSheet2Component', () => {
  let component: BalanceSheet2Component;
  let fixture: ComponentFixture<BalanceSheet2Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [BalanceSheet2Component]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BalanceSheet2Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
