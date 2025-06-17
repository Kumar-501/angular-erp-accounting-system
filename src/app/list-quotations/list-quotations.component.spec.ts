import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ListQuotationsComponent } from './list-quotations.component';

describe('ListQuotationsComponent', () => {
  let component: ListQuotationsComponent;
  let fixture: ComponentFixture<ListQuotationsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ListQuotationsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ListQuotationsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
