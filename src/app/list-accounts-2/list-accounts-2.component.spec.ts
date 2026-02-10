import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ListAccounts2Component } from './list-accounts-2.component';

describe('ListAccounts2Component', () => {
  let component: ListAccounts2Component;
  let fixture: ComponentFixture<ListAccounts2Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ListAccounts2Component]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ListAccounts2Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
