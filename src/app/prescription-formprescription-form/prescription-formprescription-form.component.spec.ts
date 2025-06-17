import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PrescriptionFormprescriptionFormComponent } from './prescription-formprescription-form.component';

describe('PrescriptionFormprescriptionFormComponent', () => {
  let component: PrescriptionFormprescriptionFormComponent;
  let fixture: ComponentFixture<PrescriptionFormprescriptionFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PrescriptionFormprescriptionFormComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PrescriptionFormprescriptionFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
