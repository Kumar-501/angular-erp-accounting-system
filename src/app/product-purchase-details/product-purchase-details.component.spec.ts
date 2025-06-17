import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProductPurchaseDetailsComponent } from './product-purchase-details.component';

describe('ProductPurchaseDetailsComponent', () => {
  let component: ProductPurchaseDetailsComponent;
  let fixture: ComponentFixture<ProductPurchaseDetailsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ProductPurchaseDetailsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProductPurchaseDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
