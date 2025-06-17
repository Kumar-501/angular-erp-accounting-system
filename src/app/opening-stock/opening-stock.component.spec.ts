import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OpeningStockComponent } from './opening-stock.component';

describe('OpeningStockComponent', () => {
  let component: OpeningStockComponent;
  let fixture: ComponentFixture<OpeningStockComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [OpeningStockComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OpeningStockComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
