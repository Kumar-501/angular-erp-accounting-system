import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SalesCustomersComponent } from './sales-customers.component';

describe('SalesCustomersComponent', () => {
  let component: SalesCustomersComponent;
  let fixture: ComponentFixture<SalesCustomersComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SalesCustomersComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SalesCustomersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
