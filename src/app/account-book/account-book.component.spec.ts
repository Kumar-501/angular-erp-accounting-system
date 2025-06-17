import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AccountBookComponent } from './account-book.component';

describe('AccountBookComponent', () => {
  let component: AccountBookComponent;
  let fixture: ComponentFixture<AccountBookComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AccountBookComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AccountBookComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
