import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PpServicePopupComponent } from './pp-service-popup.component';

describe('PpServicePopupComponent', () => {
  let component: PpServicePopupComponent;
  let fixture: ComponentFixture<PpServicePopupComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PpServicePopupComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PpServicePopupComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
