import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddPurchaseRequisitionComponent } from './add-purchase-requisition.component';

describe('AddPurchaseRequisitionComponent', () => {
  let component: AddPurchaseRequisitionComponent;
  let fixture: ComponentFixture<AddPurchaseRequisitionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AddPurchaseRequisitionComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddPurchaseRequisitionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
