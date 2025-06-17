import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DepartmentCountComponent } from './department-count.component';

describe('DepartmentCountComponent', () => {
  let component: DepartmentCountComponent;
  let fixture: ComponentFixture<DepartmentCountComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [DepartmentCountComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DepartmentCountComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
