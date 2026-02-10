import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ImportPatientsComponent } from './import-patients.component';

describe('ImportPatientsComponent', () => {
  let component: ImportPatientsComponent;
  let fixture: ComponentFixture<ImportPatientsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ImportPatientsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ImportPatientsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
