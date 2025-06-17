import { Component, OnInit } from '@angular/core';
import { FollowupCategoryService } from '../../services/followup-category.service';

// Define types for better type safety
interface FollowupCategory {
  id: string;
  name: string;
  description: string;
  [key: string]: any; // Allow dynamic property access
}

interface VisibleColumns {
  [key: string]: boolean; // Add index signature
  name: boolean;
  description: boolean;
  action: boolean;
}

interface ColumnOption {
  key: keyof VisibleColumns; // Use keyof to ensure keys match VisibleColumns
  label: string;
}

@Component({
  selector: 'app-followup-category',
  templateUrl: './followup-category.component.html',
  styleUrls: ['./followup-category.component.scss']
})
export class FollowupCategoryComponent implements OnInit {
  // Toggle form visibility
  showForm = false;
  showColumnVisibility = false;
  isEditing = false;
  
  visibleColumns: VisibleColumns = {
    name: true,
    description: true,
    action: true
  };

  columnOptions: ColumnOption[] = [
    { key: 'name', label: 'Followup Category' },
    { key: 'description', label: 'Description' },
    { key: 'action', label: 'Action' }
  ];

  // Pagination properties
  currentPage = 1;
  pageSize = 25;
  sortField = 'name';
  sortDirection = 'asc';
  searchText = '';

  // Model for the followup category data
  followupCategory: FollowupCategory = {
    id: '',
    name: '',
    description: ''
  };

  // List of categories fetched from Firestore
  followupCategories: FollowupCategory[] = [];
  filteredCategories: FollowupCategory[] = [];

  constructor(private followupCategoryService: FollowupCategoryService) {}

  ngOnInit(): void {
    this.loadCategories();  // Load categories when the component is initialized
  }

  // Toggle form visibility
  toggleForm(): void {
    this.showForm = !this.showForm;
    if (!this.showForm) {
      this.resetForm();
    }
  }

  // Toggle column visibility menu
  toggleColumnVisibility(): void {
    this.showColumnVisibility = !this.showColumnVisibility;
  }

  // Load all categories from Firestore
  loadCategories(): void {
    this.followupCategoryService.getFollowupCategories().then(data => {
      this.followupCategories = data;
      this.filteredCategories = [...data];
      this.sortData();
    }).catch(error => {
      console.error("Error fetching categories: ", error);
    });
  }

  // Save the new follow-up category to Firestore
  onSave(): void {
    if (this.followupCategory.name && this.followupCategory.description) {
      if (this.isEditing) {
        this.followupCategoryService.updateFollowupCategory(this.followupCategory).then(() => {
          console.log('Category updated!');
          this.loadCategories();  // Reload categories after updating
          this.resetForm();  // Reset the form after saving
          this.toggleForm();  // Close the form
        }).catch((error) => {
          console.error('Error updating category: ', error);
        });
      } else {
        this.followupCategoryService.addFollowupCategory(this.followupCategory).then(() => {
          console.log('Category added!');
          this.loadCategories();  // Reload categories after adding a new one
          this.resetForm();  // Reset the form after saving
          this.toggleForm();  // Close the form
        }).catch((error) => {
          console.error('Error adding category: ', error);
        });
      }
    } else {
      alert('Please fill in all fields!');
    }
  }

  // Edit category
  editCategory(category: FollowupCategory): void {
    this.isEditing = true;
    this.followupCategory = { ...category };
    this.toggleForm();
  }

  // Delete category
  deleteCategory(category: FollowupCategory): void {
    if (confirm('Are you sure you want to delete this category?')) {
      this.followupCategoryService.deleteFollowupCategory(category.id).then(() => {
        console.log('Category deleted!');
        this.loadCategories();  // Reload categories after deletion
      }).catch((error) => {
        console.error('Error deleting category: ', error);
      });
    }
  }

  // Reset the form after saving data
  resetForm(): void {
    this.followupCategory = {
      id: '',
      name: '',
      description: ''
    };
    this.isEditing = false;
  }

  // Sorting functionality
  sort(field: string): void {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = 'asc';
    }
    this.sortData();
  }

  sortData(): void {
    this.filteredCategories.sort((a, b) => {
      const valueA = a[this.sortField]?.toLowerCase() || '';
      const valueB = b[this.sortField]?.toLowerCase() || '';
      
      if (valueA < valueB) {
        return this.sortDirection === 'asc' ? -1 : 1;
      }
      if (valueA > valueB) {
        return this.sortDirection === 'asc' ? 1 : -1;
      }
      return 0;
    });
    this.currentPage = 1;
  }

  // Filtering functionality
  applyFilter(): void {
    if (!this.searchText) {
      this.filteredCategories = [...this.followupCategories];
    } else {
      const searchTextLower = this.searchText.toLowerCase();
      this.filteredCategories = this.followupCategories.filter(category => 
        category.name.toLowerCase().includes(searchTextLower) || 
        (category.description && category.description.toLowerCase().includes(searchTextLower))
      );
    }
    this.currentPage = 1;
    this.sortData();
  }

  // Pagination methods
  getPaginatedData(): FollowupCategory[] {
    const startIndex = (this.currentPage - 1) * this.pageSize;
    return this.filteredCategories.slice(startIndex, startIndex + this.pageSize);
  }

  getStartIndex(): number {
    return (this.currentPage - 1) * this.pageSize + 1;
  }

  getEndIndex(): number {
    const endIndex = this.currentPage * this.pageSize;
    return endIndex > this.filteredCategories.length ? this.filteredCategories.length : endIndex;
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  nextPage(): void {
    if (this.currentPage * this.pageSize < this.filteredCategories.length) {
      this.currentPage++;
    }
  }

  onPageSizeChange(): void {
    this.currentPage = 1;
  }

  getVisibleColumnCount(): number {
    return Object.values(this.visibleColumns).filter(val => val).length;
  }

  // Export to CSV
  exportToCSV(): void {
    const headers: string[] = [];
    const dataKeys: (keyof FollowupCategory)[] = [];
    
    if (this.visibleColumns.name) {
      headers.push('Followup Category');
      dataKeys.push('name');
    }
    if (this.visibleColumns.description) {
      headers.push('Description');
      dataKeys.push('description');
    }

    const csvData = this.filteredCategories.map(category => 
      dataKeys.map(key => category[key])
    );

    const csvContent = [headers, ...csvData].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', 'followup_categories.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Export to Excel
  exportToExcel(): void {
    import('xlsx').then(xlsx => {
      const dataToExport = this.filteredCategories.map(category => {
        const item: Record<string, any> = {};
        if (this.visibleColumns.name) item['Followup Category'] = category.name;
        if (this.visibleColumns.description) item['Description'] = category.description;
        return item;
      });

      const worksheet = xlsx.utils.json_to_sheet(dataToExport);
      const workbook = { Sheets: { 'data': worksheet }, SheetNames: ['data'] };
      const excelBuffer = xlsx.write(workbook, { bookType: 'xlsx', type: 'array' });
      this.saveAsExcelFile(excelBuffer, 'followup_categories');
    });
  }

  private saveAsExcelFile(buffer: any, fileName: string): void {
    import('file-saver').then(FileSaver => {
      const data: Blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      FileSaver.saveAs(data, `${fileName}_export_${new Date().getTime()}.xlsx`);
    });
  }

  // Print functionality
  print(): void {
    const printContent = document.createElement('div');
    
    // Create table headers based on visible columns
    let tableHeaders = '<tr>';
    if (this.visibleColumns.name) tableHeaders += '<th style="padding: 8px; text-align: left; background-color: #f2f2f2;">Followup Category</th>';
    if (this.visibleColumns.description) tableHeaders += '<th style="padding: 8px; text-align: left; background-color: #f2f2f2;">Description</th>';
    tableHeaders += '</tr>';

    // Create table rows based on visible columns
    const tableRows = this.filteredCategories.map(category => {
      let row = '<tr>';
      if (this.visibleColumns.name) row += `<td style="padding: 8px;">${category.name}</td>`;
      if (this.visibleColumns.description) row += `<td style="padding: 8px;">${category.description}</td>`;
      row += '</tr>';
      return row;
    }).join('');

    printContent.innerHTML = `
      <h1 style="text-align: center; margin-bottom: 20px;">Followup Categories</h1>
      <table border="1" style="width: 100%; border-collapse: collapse;">
        <thead>
          ${tableHeaders}
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
      <div style="margin-top: 20px; text-align: right; font-size: 12px;">
        Printed on ${new Date().toLocaleString()}
      </div>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Followup Categories</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              @media print {
                @page { size: auto; margin: 10mm; }
              }
            </style>
          </head>
          <body>
            ${printContent.innerHTML}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    } else {
      alert('Please allow popups to use the print feature.');
    }
  }

  // Export to PDF
  exportToPDF(): void {
    import('jspdf').then(jsPDF => {
      import('jspdf-autotable').then(x => {
        const doc = new jsPDF.default();
        
        // Prepare columns based on visibility
        const columns: { header: string; dataKey: string }[] = [];
        
        if (this.visibleColumns.name) {
          columns.push({ header: 'Followup Category', dataKey: 'name' });
        }
        if (this.visibleColumns.description) {
          columns.push({ header: 'Description', dataKey: 'description' });
        }

        // Prepare data
        const data = this.filteredCategories.map(category => {
          const item: Record<string, any> = {};
          if (this.visibleColumns.name) item['name'] = category.name;
          if (this.visibleColumns.description) item['description'] = category.description;
          return item;
        });

        (doc as any).autoTable({
          columns: columns,
          body: data,
          theme: 'grid',
          styles: { fontSize: 8 },
          headStyles: { fillColor: [41, 128, 185], textColor: 255 }
        });
        
        doc.save(`followup_categories_${new Date().getTime()}.pdf`);
      });
    });
  }
}