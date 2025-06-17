import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SalesViewComponent } from './sales-view.component';

describe('SalesViewComponent', () => {
  let component: SalesViewComponent;
  let fixture: ComponentFixture<SalesViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SalesViewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SalesViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
