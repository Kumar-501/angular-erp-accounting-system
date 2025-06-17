import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FollowsUpComponent } from './follows-up.component';

describe('FollowsUpComponent', () => {
  let component: FollowsUpComponent;
  let fixture: ComponentFixture<FollowsUpComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [FollowsUpComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FollowsUpComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
