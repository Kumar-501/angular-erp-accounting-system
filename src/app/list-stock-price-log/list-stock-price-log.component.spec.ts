import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ListStockPriceLogComponent } from './list-stock-price-log.component';

describe('ListStockPriceLogComponent', () => {
  let component: ListStockPriceLogComponent;
  let fixture: ComponentFixture<ListStockPriceLogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ListStockPriceLogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ListStockPriceLogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
