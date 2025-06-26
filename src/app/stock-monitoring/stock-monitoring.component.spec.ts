import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StockMonitoringComponent } from './stock-monitoring.component';

describe('StockMonitoringComponent', () => {
  let component: StockMonitoringComponent;
  let fixture: ComponentFixture<StockMonitoringComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [StockMonitoringComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StockMonitoringComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
