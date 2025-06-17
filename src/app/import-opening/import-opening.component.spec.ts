import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ImportOpeningComponent } from './import-opening.component';

describe('ImportOpeningComponent', () => {
  let component: ImportOpeningComponent;
  let fixture: ComponentFixture<ImportOpeningComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ImportOpeningComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ImportOpeningComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
