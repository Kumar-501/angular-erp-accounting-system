import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NotSellingComponent } from './not-selling.component';

describe('NotSellingComponent', () => {
  let component: NotSellingComponent;
  let fixture: ComponentFixture<NotSellingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [NotSellingComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NotSellingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
