import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FollowFormComponent } from './follow-form.component';

describe('FollowFormComponent', () => {
  let component: FollowFormComponent;
  let fixture: ComponentFixture<FollowFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [FollowFormComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FollowFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
