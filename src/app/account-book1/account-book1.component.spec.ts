import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AccountBook1Component } from './account-book1.component';

describe('AccountBook1Component', () => {
  let component: AccountBook1Component;
  let fixture: ComponentFixture<AccountBook1Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AccountBook1Component]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AccountBook1Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
