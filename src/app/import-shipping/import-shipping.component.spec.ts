import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ImportShippingComponent } from './import-shipping.component';

describe('ImportShippingComponent', () => {
  let component: ImportShippingComponent;
  let fixture: ComponentFixture<ImportShippingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ImportShippingComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ImportShippingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
