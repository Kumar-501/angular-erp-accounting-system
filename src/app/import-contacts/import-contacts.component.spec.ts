import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ImportContactsComponent } from './import-contacts.component';

describe('ImportContactsComponent', () => {
  let component: ImportContactsComponent;
  let fixture: ComponentFixture<ImportContactsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ImportContactsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ImportContactsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
