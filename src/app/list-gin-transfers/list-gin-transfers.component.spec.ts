import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ListGinTransfersComponent } from './list-gin-transfers.component';

describe('ListGinTransfersComponent', () => {
  let component: ListGinTransfersComponent;
  let fixture: ComponentFixture<ListGinTransfersComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ListGinTransfersComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ListGinTransfersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
