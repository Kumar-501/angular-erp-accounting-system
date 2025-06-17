import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditGinTransferComponent } from './edit-gin-transfer.component';

describe('EditGinTransferComponent', () => {
  let component: EditGinTransferComponent;
  let fixture: ComponentFixture<EditGinTransferComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [EditGinTransferComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EditGinTransferComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
