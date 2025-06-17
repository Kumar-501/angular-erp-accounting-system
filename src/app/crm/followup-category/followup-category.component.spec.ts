import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FollowupCategoryComponent } from './followup-category.component';

describe('FollowupCategoryComponent', () => {
  let component: FollowupCategoryComponent;
  let fixture: ComponentFixture<FollowupCategoryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [FollowupCategoryComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FollowupCategoryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
