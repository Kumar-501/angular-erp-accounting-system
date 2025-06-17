// view-expense.component.ts
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ExpenseService, Expense } from '../services/expense.service'; // Import both from service

@Component({
  selector: 'app-view-expense',
  templateUrl: './view-expense.component.html',
  styleUrls: ['./view-expense.component.scss']
})
export class ViewExpenseComponent implements OnInit {
  expense: Expense | undefined;

  constructor(
    private route: ActivatedRoute,
    private expenseService: ExpenseService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadExpense();
  }

  async loadExpense(): Promise<void> {
    const expenseId = this.route.snapshot.paramMap.get('id');
    if (expenseId) {
      try {
        const result = await this.expenseService.getExpenseById(expenseId);
        this.expense = result || undefined; // Convert null to undefined
      } catch (error) {
        console.error('Error fetching expense:', error);
        // Handle error - could show user-friendly message
        this.expense = undefined;
      }
    }
  }

  // Go Back button handler
  goBack(): void {
    this.router.navigate(['/list-expenses']); // Navigate back to the list-expenses page
  }
}