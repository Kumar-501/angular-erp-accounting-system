import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SellReturnComponent } from './sell-return.component';

describe('SellReturnComponent', () => {
  let component: SellReturnComponent;
  let fixture: ComponentFixture<SellReturnComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SellReturnComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SellReturnComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
