import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GinTransferViewComponent } from './gin-transfer-view.component';

describe('GinTransferViewComponent', () => {
  let component: GinTransferViewComponent;
  let fixture: ComponentFixture<GinTransferViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [GinTransferViewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GinTransferViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
