import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddPrintersComponent } from './add-printers.component';

describe('AddPrintersComponent', () => {
  let component: AddPrintersComponent;
  let fixture: ComponentFixture<AddPrintersComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AddPrintersComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddPrintersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
