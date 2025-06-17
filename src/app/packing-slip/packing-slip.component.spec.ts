import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PackingSlipComponent } from './packing-slip.component';

describe('PackingSlipComponent', () => {
  let component: PackingSlipComponent;
  let fixture: ComponentFixture<PackingSlipComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PackingSlipComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PackingSlipComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
