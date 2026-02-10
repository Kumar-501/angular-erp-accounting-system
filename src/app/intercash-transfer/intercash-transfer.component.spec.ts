import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IntercashTransferComponent } from './intercash-transfer.component';

describe('IntercashTransferComponent', () => {
  let component: IntercashTransferComponent;
  let fixture: ComponentFixture<IntercashTransferComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [IntercashTransferComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(IntercashTransferComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
