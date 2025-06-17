import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddBarcodesComponent } from './add-barcodes.component';

describe('AddBarcodesComponent', () => {
  let component: AddBarcodesComponent;
  let fixture: ComponentFixture<AddBarcodesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AddBarcodesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddBarcodesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
