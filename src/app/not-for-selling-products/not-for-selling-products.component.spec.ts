import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NotForSellingProductsComponent } from './not-for-selling-products.component';

describe('NotForSellingProductsComponent', () => {
  let component: NotForSellingProductsComponent;
  let fixture: ComponentFixture<NotForSellingProductsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [NotForSellingProductsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NotForSellingProductsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
