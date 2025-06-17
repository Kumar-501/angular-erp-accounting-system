import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ListDraftComponent } from './list-draft.component';

describe('ListDraftComponent', () => {
  let component: ListDraftComponent;
  let fixture: ComponentFixture<ListDraftComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ListDraftComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ListDraftComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
