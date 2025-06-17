import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddGinTransferComponent } from './add-gin-transfer.component';

describe('AddGinTransferComponent', () => {
  let component: AddGinTransferComponent;
  let fixture: ComponentFixture<AddGinTransferComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AddGinTransferComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddGinTransferComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
