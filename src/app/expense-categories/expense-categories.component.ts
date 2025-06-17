import { Component, OnInit } from '@angular/core';
import { ExpenseCategoriesService } from '../services/expense-categories.service';
import { Observable, combineLatest, map } from 'rxjs';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

@Component({
  selector: 'app-expense-categories',
  templateUrl: './expense-categories.component.html',
  styleUrls: ['./expense-categories.component.scss']
})
export class ExpenseCategoriesComponent implements OnInit {
  expenseCategories$!: Observable<any[]>;
  allCategories: any[] = []; // Store all categories for export
  categoryForm!: FormGroup;
  showModal: boolean = false;
  isEditing: boolean = false;
  sortField: string = 'categoryName';
  sortDirection: 'asc' | 'desc' = 'asc';

  currentPage: number = 1;
  itemsPerPage: number = 25;
  
  parentCategories: any[] = [];
  editingCategoryId: string | null = null;
  editingCategoryType: string = 'expense'; // Track original type for editing
  
  constructor(private expenseService: ExpenseCategoriesService, private fb: FormBuilder) {}
  
  ngOnInit(): void {
    // Combine both expense and income categories
    this.expenseCategories$ = combineLatest([
      this.expenseService.getExpenseCategories(),
      this.expenseService.getIncomeCategories()
    ]).pipe(
      map(([expenseCategories, incomeCategories]) => {
        return [...expenseCategories, ...incomeCategories];
      })
    );
    
    this.categoryForm = this.fb.group({
      categoryName: ['', Validators.required],
      categoryCode: [''],
      type: ['expense'], // Add this for radio button
      accountHead: [''],
      isSubCategory: [false],
      parentCategory: ['None']
    });
    
    this.expenseCategories$.subscribe(categories => {
      this.allCategories = categories;
      this.parentCategories = categories.filter(cat => !cat.isSubCategory);
    });
  }

  sortData(field: string) {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = 'asc';
    }
  
    this.applySorting();
  }
  
  private applySorting() {
    this.expenseCategories$.subscribe(categories => {
      this.allCategories = categories.sort((a, b) => {
        let valueA = a[this.sortField] || '';
        let valueB = b[this.sortField] || '';
  
        if (typeof valueA === 'string') valueA = valueA.toLowerCase();
        if (typeof valueB === 'string') valueB = valueB.toLowerCase();
  
        if (valueA < valueB) return this.sortDirection === 'asc' ? -1 : 1;
        if (valueA > valueB) return this.sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    });
  }

  // Get filtered account head options based on selected type
  getAccountHeadOptions() {
    const selectedType = this.categoryForm.get('type')?.value;
    
    if (selectedType === 'income') {
      return [
        { group: 'Income', options: [
          { value: 'Sales', label: 'Sales' },
    { value: 'Direct Income', label: 'Direct Income' },
          { value: 'Indirect Income', label: 'Indirect Income' }
        ]}
      ];
    } else {
      return [
      
        { group: 'Expense', options: [
          { value: 'Indirect Expense', label: 'Indirect Expense' },
          { value: 'Direct Expense', label: 'Direct Expense' },
          { value: 'Cost of Goods Sold', label: 'Cost of Goods Sold' },
          { value: 'GST Deposit', label: 'GST Deposit' },
          { value: 'TDS Deposit', label: 'TDS Deposit' },

        ]}
      ];
    }
  }

  // Handle type change to reset account head
  onTypeChange() {
    this.categoryForm.patchValue({ accountHead: '' });
  }

  // Export functionality
  exportData(format: string) {
    this.expenseCategories$.subscribe(categories => {
      switch(format) {
        case 'csv':
          this.exportToCSV(categories);
          break;
        case 'excel':
          this.exportToExcel(categories);
          break;
        case 'print':
          this.printTable(categories);
          break;
        case 'pdf':
          this.exportToPDF(categories);
          break;
        default:
          console.warn('Unknown export format:', format);
      }
    });
  }

  private exportToCSV(categories: any[]) {
    const headers = ['Category Name', 'Category Code', 'Type', 'Account Head', 'Sub-Category', 'Parent Category'];
    const data = categories.map(cat => [
      cat.categoryName,
      cat.categoryCode || '-',
      cat.type || 'expense',
      cat.accountHead || '-',
      cat.isSubCategory ? 'Yes' : 'No',
      cat.parentCategory || '-'
    ]);

    let csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(',') + "\n" 
      + data.map(e => e.join(',')).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `expense_categories_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  private exportToExcel(categories: any[]) {
    const worksheet = XLSX.utils.json_to_sheet(categories.map(cat => ({
      'Category Name': cat.categoryName,
      'Category Code': cat.categoryCode || '-',
      'Type': cat.type || 'expense',
      'Account Head': cat.accountHead || '-',
      'Sub-Category': cat.isSubCategory ? 'Yes' : 'No',
      'Parent Category': cat.parentCategory || '-'
    })));
    
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Categories");
    XLSX.writeFile(workbook, `expense_categories_${new Date().toISOString().slice(0,10)}.xlsx`);
  }

  private printTable(categories: any[]) {
    const printContent = `
      <html>
        <head>
          <title>Expense Categories Report</title>
          <style>
            body { font-family: Arial; margin: 20px; }
            h1 { color: #333; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            .no-data { text-align: center; padding: 20px; }
          </style>
        </head>
        <body>
          <h1>Expense Categories</h1>
          <p>Generated on: ${new Date().toLocaleDateString()}</p>
          <table>
            <thead>
              <tr>
                <th>Category Name</th>
                <th>Category Code</th>
                <th>Type</th>
                <th>Account Head</th>
                <th>Sub-Category</th>
                <th>Parent Category</th>
              </tr>
            </thead>
            <tbody>
              ${categories.length > 0 ? 
                categories.map(cat => `
                  <tr>
                    <td>${cat.categoryName}</td>
                    <td>${cat.categoryCode || '-'}</td>
                    <td>${cat.type || 'expense'}</td>
                    <td>${cat.accountHead || '-'}</td>
                    <td>${cat.isSubCategory ? 'Yes' : 'No'}</td>
                    <td>${cat.parentCategory || '-'}</td>
                  </tr>
                `).join('') : `
                <tr>
                  <td colspan="6" class="no-data">No categories found</td>
                </tr>
              `}
            </tbody>
          </table>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                window.close();
              }, 100);
            };
          </script>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
    }
  }

  private exportToPDF(categories: any[]) {
    const doc = new jsPDF();
    const title = 'Expense Categories Report';
    
    doc.text(title, 14, 16);
    
    (doc as any).autoTable({
      head: [['Category Name', 'Category Code', 'Type', 'Account Head', 'Sub-Category', 'Parent Category']],
      body: categories.map(cat => [
        cat.categoryName,
        cat.categoryCode || '-',
        cat.type || 'expense',
        cat.accountHead || '-',
        cat.isSubCategory ? 'Yes' : 'No',
        cat.parentCategory || '-'
      ]),
      startY: 25,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255 }
    });
    
    doc.save(`expense_categories_${new Date().toISOString().slice(0,10)}.pdf`);
  }

  openModal(category: any = null) {
    this.showModal = true;
    
    if (category) {
      this.isEditing = true;
      this.editingCategoryId = category.id;
      this.editingCategoryType = category.type || 'expense'; // Store original type
      this.categoryForm.patchValue({
        categoryName: category.categoryName,
        categoryCode: category.categoryCode,
        type: category.type || 'expense', // Default to expense if not set
        accountHead: category.accountHead || '',
        isSubCategory: category.isSubCategory,
        parentCategory: category.parentCategory || 'None'
      });
    } else {
      this.isEditing = false;
      this.editingCategoryId = null;
      this.editingCategoryType = 'expense';
      this.categoryForm.reset({ 
        isSubCategory: false, 
        parentCategory: 'None',
        accountHead: '',
        type: 'expense' // Default to expense for new categories
      });
    }
  }

  closeModal() {
    this.showModal = false;
    this.isEditing = false;
  }
  
  async saveCategory() {
    if (this.categoryForm.valid) {
      const categoryData = {
        ...this.categoryForm.value,
        accountHead: this.categoryForm.value.accountHead || null,
        type: this.categoryForm.value.type // Include the type
      };
      
      if (this.isEditing && this.editingCategoryId) {
        await this.expenseService.updateCategory(
          this.editingCategoryId, 
          categoryData, 
          this.editingCategoryType
        );
      } else {
        await this.expenseService.addCategory(categoryData);
      }
      
      this.closeModal();
    }
  }
  
  async deleteCategory(id: string, type: string = 'expense') {
    if (confirm('Are you sure you want to delete this category?')) {
      await this.expenseService.deleteCategory(id, type);
    }
  }
  
  navigatePage(direction: string) {
    if (direction === 'prev' && this.currentPage > 1) {
      this.currentPage--;
    } else if (direction === 'next') {
      this.currentPage++;
    }
  }
  
  changeItemsPerPage(event: any) {
    this.itemsPerPage = parseInt(event.target.value);
    this.currentPage = 1;
  }
}