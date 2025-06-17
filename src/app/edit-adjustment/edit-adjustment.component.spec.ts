import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditAdjustmentComponent } from './edit-adjustment.component';

describe('EditAdjustmentComponent', () => {
  let component: EditAdjustmentComponent;
  let fixture: ComponentFixture<EditAdjustmentComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [EditAdjustmentComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EditAdjustmentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
