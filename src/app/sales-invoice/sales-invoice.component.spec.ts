import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SalesInvoiceComponent } from './sales-invoice.component';

describe('SalesInvoiceComponent', () => {
  let component: SalesInvoiceComponent;
  let fixture: ComponentFixture<SalesInvoiceComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SalesInvoiceComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SalesInvoiceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
