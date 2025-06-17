import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SupplierPurchasesComponent } from './supplier-purchases.component';

describe('SupplierPurchasesComponent', () => {
  let component: SupplierPurchasesComponent;
  let fixture: ComponentFixture<SupplierPurchasesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SupplierPurchasesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SupplierPurchasesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
