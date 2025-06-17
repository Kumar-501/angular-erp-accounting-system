import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CodPopupComponent } from './cod-popup.component';

describe('CodPopupComponent', () => {
  let component: CodPopupComponent;
  let fixture: ComponentFixture<CodPopupComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CodPopupComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CodPopupComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
