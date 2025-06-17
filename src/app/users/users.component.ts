import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { UserService } from '../services/user.service';
import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'passwordMask' })
export class PasswordMaskPipe implements PipeTransform {
  transform(value: string): string {
    if (!value) return '••••••••';
    return value.replace(/./g, '•');
  }
}

@Component({
  selector: 'app-users',
  templateUrl: './users.component.html',
  styleUrls: ['./users.component.scss']
})
export class UsersComponent implements OnInit {
  users: any[] = [];
  filteredUsers: any[] = [];
  entries: number = 10;
  currentPage: number = 1;
  totalEntries: number = 0;
  totalPages: number = 0;
  searchQuery: string = '';
  showListForUser: number | null = null;
  selectedRole: string = '';
selectedDepartment: string = '';
selectedDesignation: string = '';
selectedBranch: string = '';
  isFilterSidebarOpen: boolean = false;
  branches: string[] = ['PC1', 'PC2', 'PC3', 'PC4', 'Purchase'];
  selectedBranches: string[] = [];
  // Sorting properties
  sortColumn: string = 'username';
  sortDirection: string = 'asc';
  
  // Filter sidebar properties
  
  // Column visibility properties
  isColumnVisibilityOpen: boolean = false;
  columns = [
    { name: 'employeeId', display: 'Employee ID', visible: true },
    { name: 'username', display: 'Username', visible: true },
    { name: 'role', display: 'Role', visible: true },
    { name: 'department', display: 'Department', visible: true },
    { name: 'designation', display: 'Designation', visible: true },
    { name: 'email', display: 'Email', visible: true },
    { name: 'password', display: 'Password', visible: true },
    { name: 'status', display: 'Status', visible: true },
    { name: 'actions', display: 'Actions', visible: true }
  ];
  
  // Filter options
  designations: string[] = [];
  departments: string[] = [];
  roles: string[] = [];
  
  // Selected filters
  selectedDesignations: string[] = [];
  selectedDepartments: string[] = [];
  selectedRoles: string[] = [];
  showActive: boolean = true;
  showInactive: boolean = true;

  constructor(private router: Router, private userService: UserService) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  // Helper method to count visible columns
  getVisibleColumnsCount(): number {
    return this.columns.filter(column => column.visible).length;
  }

  loadUsers(): void {
    this.userService.getUsers().subscribe(users => {
      this.users = users;
      this.filteredUsers = [...users];
      
      // Extract unique values for filters
      this.extractFilterOptions();
      
      this.sortUsers(this.sortColumn, this.sortDirection);
      this.updatePagination();
    });
  }
  toggleFilterSidebar(): void {
    this.isFilterSidebarOpen = !this.isFilterSidebarOpen;
  }
  
  toggleList(userId: number) {
    if (this.showListForUser === userId) {
      this.showListForUser = null;
    } else {
      this.showListForUser = userId;
    }
  }
  
  extractFilterOptions(): void {
    // Get unique designations
    this.designations = [...new Set(this.users
      .map(user => user.designation)
      .filter(designation => designation))];
    
    // Get unique departments
    this.departments = [...new Set(this.users
      .map(user => user.department)
      .filter(department => department))];
    
    // Get unique roles
    this.roles = [...new Set(this.users
      .map(user => user.role)
      .filter(role => role))];
  }









  applyFilters(): void {
    this.filteredUsers = this.users.filter(user => {
      // Designation filter
      if ((!this.showActive && user.isActive) || 
      (!this.showInactive && !user.isActive)) {
    return false;
  }
  
  // Role filter
  if (this.selectedRole && user.role !== this.selectedRole) {
    return false;
  }
  
  // Department filter
  if (this.selectedDepartment && user.department !== this.selectedDepartment) {
    return false;
  }
  
  // Designation filter
  if (this.selectedDesignation && user.designation !== this.selectedDesignation) {
    return false;
  }
  
  // Branch filter
  if (this.selectedBranch && user.branch !== this.selectedBranch) {
    return false;
  }
  
  return true;
});

    
    // Apply search if there's a search query
    if (this.searchQuery) {
      this.applySearch();
    }
    
    // Reset to first page and update pagination
    this.currentPage = 1;
    this.sortUsers(this.sortColumn, this.sortDirection);
    this.updatePagination();
    this.toggleFilterSidebar(); // Close the sidebar after applying

    // Close the sidebar
  }

  applySearch(): void {
    this.filteredUsers = this.filteredUsers.filter(user => 
      (user.employeeId?.toLowerCase().includes(this.searchQuery)) ||
      (user.username?.toLowerCase().includes(this.searchQuery)) ||
      (user.role?.toLowerCase().includes(this.searchQuery)) ||
      (user.department?.toLowerCase().includes(this.searchQuery)) ||
      (user.designation?.toLowerCase().includes(this.searchQuery)) ||
      (user.email?.toLowerCase().includes(this.searchQuery)) ||
      (user.isActive ? 'active' : 'inactive').includes(this.searchQuery)
    );
  }

  resetFilters(): void {
    this.showActive = true;
    this.showInactive = true;
    this.selectedRole = '';
    this.selectedDepartment = '';
    this.selectedDesignation = '';
    this.selectedBranch = '';
    
    this.filteredUsers = [...this.users];
    
    if (this.searchQuery) {
      this.applySearch();
    }
    
    this.currentPage = 1;
    this.updatePagination();
  }
  goToAddUserPage() {
    this.router.navigate(['/add-users']);
  }
  onFilterChange(): void {
    this.applyFilters(); // Reuses your existing filter logic
  }
  viewUser(userId: string): void {
    this.router.navigate(['/view-user', userId]);
  }

  editUser(userId: string): void {
    this.router.navigate(['/edit-user', userId]);
  }

  deleteUser(userId: string): void {
    if (confirm('Are you sure you want to delete this user?')) {
      this.userService.deleteUser(userId)
        .then(() => {
          console.log('User deleted successfully');
          this.loadUsers(); // Refresh the user list
        })
        .catch((error) => {
          console.error('Error deleting user: ', error);
        });
    }
  }

  exportCSV(): void {
    const headers = this.columns
      .filter(col => col.visible && col.name !== 'password' && col.name !== 'actions')
      .map(col => col.display);
    
    let csvContent = headers.join(',') + '\n';

    this.filteredUsers.forEach(user => {
      const row = this.columns
        .filter(col => col.visible && col.name !== 'password' && col.name !== 'actions')
        .map(col => {
          if (col.name === 'status') {
            return user.isActive ? 'Active' : 'Inactive';
          }
          return user[col.name] || '';
        });
      
      csvContent += row.join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'users_' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  }

  exportExcel(): void {
    // This would use a library like exceljs in a real implementation
    console.log('Export to Excel functionality would be implemented here');
    // Fallback to CSV if Excel export is not implemented
    this.exportCSV();
  }
  toggleColumnVisibilityDropdown(): void {
    this.isColumnVisibilityOpen = !this.isColumnVisibilityOpen;
  }
  toggleColumnVisibility(columnName: string): void {
    const column = this.columns.find(col => col.name === columnName);
    if (column) {
      column.visible = !column.visible;
    }
  }
  
  exportPDF(): void {
    // This would use a library like jspdf in a real implementation
    console.log('Export to PDF functionality would be implemented here');
  }

  print(): void {
    const printContent = document.querySelector('.user-table')?.outerHTML;
    if (printContent) {
      const originalContents = document.body.innerHTML;
      document.body.innerHTML = printContent;
      window.print();
      document.body.innerHTML = originalContents;
      window.location.reload();
    }
  }





 
// Apply column visibility changes
applyColumnVisibility(): void {
  this.isColumnVisibilityOpen = false;
  // Any additional logic you want when applying
}


resetColumnVisibility(): void {
  this.columns.forEach(column => {
    column.visible = true;
  });
}
isColumnVisible(columnName: string): boolean {
  const column = this.columns.find(col => col.name === columnName);
  return column ? column.visible : false;
}

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  search(event: any): void {
    this.searchQuery = event.target.value.toLowerCase();
    
    // Filter users based on search query
    if (this.searchQuery) {
      this.filteredUsers = this.users.filter(user => 
        (user.employeeId?.toLowerCase().includes(this.searchQuery)) ||
        (user.username?.toLowerCase().includes(this.searchQuery)) ||
        (user.role?.toLowerCase().includes(this.searchQuery)) ||
        (user.department?.toLowerCase().includes(this.searchQuery)) ||
        (user.designation?.toLowerCase().includes(this.searchQuery)) ||
        (user.email?.toLowerCase().includes(this.searchQuery)) ||
        (user.isActive ? 'active' : 'inactive').includes(this.searchQuery)
      );
    } else {
      this.filteredUsers = [...this.users];
    }
    
    // Reset to first page when searching
    this.currentPage = 1;
    // Maintain the current sort when searching
    this.sortUsers(this.sortColumn, this.sortDirection);
    this.updatePagination();
  }

  updatePagination(): void {
    this.totalEntries = this.filteredUsers.length;
    this.totalPages = Math.ceil(this.totalEntries / this.entries);
    // Make sure currentPage is valid after updating pagination
    if (this.currentPage > this.totalPages && this.totalPages > 0) {
      this.currentPage = this.totalPages;
    }
  }

  getPaginatedUsers(): any[] {
    const startIndex = (this.currentPage - 1) * this.entries;
    const endIndex = startIndex + Number(this.entries);
    return this.filteredUsers.slice(startIndex, endIndex);
  }

  sortUsers(column: string = '', direction: string = 'asc'): void {
    // If no column provided, use the current sort column
    if (!column) {
      column = this.sortColumn;
    }
    
    // If clicking the same column, toggle direction
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = direction;
    }

    // Sort the filtered users
    this.filteredUsers.sort((a: any, b: any) => {
      const valueA = a[column] ? a[column].toString().toLowerCase() : '';
      const valueB = b[column] ? b[column].toString().toLowerCase() : '';

      if (valueA === valueB) return 0;
      
      if (this.sortDirection === 'asc') {
        return valueA > valueB ? 1 : -1;
      } else {
        return valueA < valueB ? 1 : -1;
      }
    });
  }

  getSortIconClass(column: string): string {
    if (this.sortColumn === column) {
      return this.sortDirection === 'asc' ? 'fas fa-sort-up' : 'fas fa-sort-down';
    }
    return 'fas fa-sort';
  }

 
}