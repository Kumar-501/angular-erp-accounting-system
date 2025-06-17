import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SalesTargetsComponent } from './sales-targets.component';

describe('SalesTargetsComponent', () => {
  let component: SalesTargetsComponent;
  let fixture: ComponentFixture<SalesTargetsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SalesTargetsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SalesTargetsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
