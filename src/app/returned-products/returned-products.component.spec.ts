import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReturnedProductsComponent } from './returned-products.component';

describe('ReturnedProductsComponent', () => {
  let component: ReturnedProductsComponent;
  let fixture: ComponentFixture<ReturnedProductsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ReturnedProductsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ReturnedProductsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
