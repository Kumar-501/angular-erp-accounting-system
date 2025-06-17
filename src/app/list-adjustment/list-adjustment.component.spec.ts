import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ListAdjustmentComponent } from './list-adjustment.component';

describe('ListAdjustmentComponent', () => {
  let component: ListAdjustmentComponent;
  let fixture: ComponentFixture<ListAdjustmentComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ListAdjustmentComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ListAdjustmentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
