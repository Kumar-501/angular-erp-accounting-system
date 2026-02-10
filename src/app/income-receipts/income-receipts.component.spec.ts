import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IncomeReceiptsComponent } from './income-receipts.component';

describe('IncomeReceiptsComponent', () => {
  let component: IncomeReceiptsComponent;
  let fixture: ComponentFixture<IncomeReceiptsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [IncomeReceiptsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(IncomeReceiptsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
