import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LedgerViewComponent } from './ledger-view.component';

describe('LedgerViewComponent', () => {
  let component: LedgerViewComponent;
  let fixture: ComponentFixture<LedgerViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [LedgerViewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LedgerViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
