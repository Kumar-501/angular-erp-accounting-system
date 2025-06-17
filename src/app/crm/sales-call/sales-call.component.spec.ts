import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SalesCallComponent } from './sales-call.component';

describe('SalesCallComponent', () => {
  let component: SalesCallComponent;
  let fixture: ComponentFixture<SalesCallComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SalesCallComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SalesCallComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
