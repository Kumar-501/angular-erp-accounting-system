import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BarcodesComponent } from './barcodes.component';

describe('BarcodesComponent', () => {
  let component: BarcodesComponent;
  let fixture: ComponentFixture<BarcodesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [BarcodesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BarcodesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
