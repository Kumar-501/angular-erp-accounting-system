import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { UserService } from '../services/user.service';
import { DepartmentService } from '../services/department.service';
import { RolesService } from '../services/roles.service';

@Component({
  selector: 'app-user1',
  templateUrl: './user1.component.html',
  styleUrls: ['./user1.component.scss']
})
export class User1Component implements OnInit {
  users: any[] = [];
  filteredUsers: any[] = [];
  entries: number = 4;
  currentPage: number = 1;
  totalEntries: number = 0;
  totalPages: number = 0;
  searchQuery: string = '';
  sortColumn: string = 'username';
  sortDirection: string = 'asc';
  showColumnVisibilityMenu: boolean = false;
columns = [
  { name: 'employeeId', displayName: 'Employee ID', visible: true },
  { name: 'name', displayName: 'Name', visible: true },
  { name: 'username', displayName: 'Username', visible: true },
  { name: 'role', displayName: 'Role', visible: true },
  { name: 'department', displayName: 'Department', visible: true },
  { name: 'designation', displayName: 'Designation', visible: true },
  { name: 'locations', displayName: 'Locations', visible: true },
  { name: 'email', displayName: 'Email', visible: true },
  { name: 'actions', displayName: 'Actions', visible: true }
];
  
  // Filter properties
  showFilters: boolean = false;
  selectedDepartment: string = '';
  selectedRole: string = '';
  departments: string[] = [];
  roles: string[] = [];

  constructor(
    private router: Router, 
    private userService: UserService,
    private departmentService: DepartmentService,
    private rolesService: RolesService
  ) {}

  ngOnInit(): void {
    this.loadUsers();
    this.loadDepartments();
    this.loadRoles();
  }

  loadUsers(): void {
    this.userService.getUsers().subscribe(users => {
      this.users = users;
      this.applyFilters(); // Apply any existing filters
      this.updatePagination();
    });
  }

  loadDepartments(): void {
    this.departmentService.getDepartments().subscribe(departments => {
      this.departments = [...new Set(departments.map((d: any) => d.department))];
    });
  }
  toggleColumnVisibility(): void {
    this.showColumnVisibilityMenu = !this.showColumnVisibilityMenu;
  }

  loadRoles(): void {
    this.rolesService.getRoles().subscribe(roles => {
      this.roles = [...new Set(roles.map((r: any) => r.name))];
    });
  }

  toggleFilters(): void {
    this.showFilters = !this.showFilters;
  }

  applyFilters(): void {
    this.filteredUsers = this.users.filter(user => {
      const matchesDepartment = !this.selectedDepartment || 
        (user.department && user.department.toLowerCase() === this.selectedDepartment.toLowerCase());
      
      const matchesRole = !this.selectedRole || 
        (user.role && user.role.toLowerCase() === this.selectedRole.toLowerCase());
      
      const matchesSearch = !this.searchQuery || 
        (user.username && user.username.toLowerCase().includes(this.searchQuery)) ||
        (user.role && user.role.toLowerCase().includes(this.searchQuery)) ||
        (user.email && user.email.toLowerCase().includes(this.searchQuery)) ||
        (user.password && user.password.toLowerCase().includes(this.searchQuery)) ||
        (user.employeeId && user.employeeId.toLowerCase().includes(this.searchQuery)) ||
        (user.department && user.department.toLowerCase().includes(this.searchQuery)) ||
        (user.designation && user.designation.toLowerCase().includes(this.searchQuery));
      
      return matchesDepartment && matchesRole && matchesSearch;
    });

    this.sortUsers(this.sortColumn, this.sortDirection);
    this.currentPage = 1;
    this.updatePagination();
  }
  resetFilters(): void {
    this.selectedDepartment = '';
    this.selectedRole = '';
    this.searchQuery = '';
    this.filteredUsers = [...this.users];
    this.sortUsers(this.sortColumn, this.sortDirection);
    this.currentPage = 1;
    this.updatePagination();
  }

  clearFilters(): void {
    this.selectedDepartment = '';
    this.selectedRole = '';
    this.searchQuery = '';
    this.applyFilters();
  }

  // Rest of the methods remain the same as before
  goToAddUserPage() {
    this.router.navigate(['/add-users']);
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
        })
        .catch((error) => {
          console.error('Error deleting user: ', error);
        });
    }
  }

  exportCSV(): void {
    const headers = ['Employee ID', 'Name', 'Username', 'Role', 'Department', 'Designation', 'Email'];
    let csvContent = headers.join(',') + '\n';
  
    this.filteredUsers.forEach(user => {
      const row = [
        user.employeeId || '',
        `${user.prefix} ${user.firstName} ${user.lastName}`.trim(),
        user.username,
        user.role,
        user.department || '',
        user.designation || '',
        user.email
      ];
      csvContent += row.join(',') + '\n';
    });
  
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'users.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  }

  exportExcel(): void {
    console.log('Export to Excel functionality would be implemented here');
  }

  exportPDF(): void {
    console.log('Export to PDF functionality would be implemented here');
  }

// Now update the print method in your component
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


  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }
  }
  updateColumnVisibility(): void {
    // This method is triggered when checkboxes are changed
    // No need for additional logic as the *ngIf directives handle visibility
  }
  getVisibleColumnCount(): number {
    return this.columns.filter(col => col.visible).length;
  }
  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  search(event: any): void {
    this.searchQuery = event.target.value.toLowerCase();
    this.applyFilters();
  }

  updatePagination(): void {
    this.totalEntries = this.filteredUsers.length;
    this.totalPages = Math.ceil(this.totalEntries / this.entries);
    if (this.currentPage > this.totalPages && this.totalPages > 0) {
      this.currentPage = this.totalPages;
    }
  }

  getPaginatedUsers(): any[] {
    const startIndex = (this.currentPage - 1) * this.entries;
    const endIndex = startIndex + Number(this.entries);
    return this.filteredUsers.slice(startIndex, endIndex);
  }

  sortUsers(column: string, direction: string = 'asc'): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = direction;
    }

    this.filteredUsers.sort((a: any, b: any) => {
      const valueA = a[column] ? a[column].toString().toLowerCase() : '';
      const valueB = b[column] ? b[column].toString().toLowerCase() : '';

      if (this.sortDirection === 'asc') {
        return valueA.localeCompare(valueB);
      } else {
        return valueB.localeCompare(valueA);
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