import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SupplierPurchaseComponent } from './supplier-purchase.component';

describe('SupplierPurchaseComponent', () => {
  let component: SupplierPurchaseComponent;
  let fixture: ComponentFixture<SupplierPurchaseComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SupplierPurchaseComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SupplierPurchaseComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
