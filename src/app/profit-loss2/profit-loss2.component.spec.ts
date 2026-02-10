import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProfitLoss2Component } from './profit-loss2.component';

describe('ProfitLoss2Component', () => {
  let component: ProfitLoss2Component;
  let fixture: ComponentFixture<ProfitLoss2Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ProfitLoss2Component]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProfitLoss2Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
