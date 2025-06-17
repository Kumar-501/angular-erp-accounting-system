import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LifeStageComponent } from './life-stage.component';

describe('LifeStageComponent', () => {
  let component: LifeStageComponent;
  let fixture: ComponentFixture<LifeStageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [LifeStageComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LifeStageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
