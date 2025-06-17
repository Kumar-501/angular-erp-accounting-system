import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddDraftComponent } from './add-draft.component';

describe('AddDraftComponent', () => {
  let component: AddDraftComponent;
  let fixture: ComponentFixture<AddDraftComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AddDraftComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddDraftComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
