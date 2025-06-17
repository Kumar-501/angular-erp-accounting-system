import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { RolesService, Role } from '../services/roles.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-roles-table',
  templateUrl: './roles-table.component.html',
  styleUrls: ['./roles-table.component.scss']
})
export class RolesTableComponent implements OnInit, OnDestroy {
  roles: Role[] = [];
  filteredRoles: Role[] = [];
  currentPage: number = 1;
  itemsPerPage: number = 25;
  searchTerm: string = '';
  private rolesSubscription: Subscription | null = null;
  isLoading: boolean = true;
  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';
Math: any;

  constructor(
    private router: Router,
    private rolesService: RolesService
  ) {}

  ngOnInit(): void {
    this.loadRoles();
  }

  ngOnDestroy(): void {
    if (this.rolesSubscription) {
      this.rolesSubscription.unsubscribe();
    }
  }

// Modify the loadRoles method to ensure fresh data is always loaded
private loadRoles(): void {
  this.isLoading = true;
  this.rolesSubscription = this.rolesService.getRoles().subscribe({
    next: (roles) => {
      this.roles = roles;
      this.filteredRoles = this.filterRoles();
      this.currentPage = 1;
      this.isLoading = false;
    },
    error: (error) => {
      console.error('Error loading roles:', error);
      this.isLoading = false;
    }
  });
}

// Add this method to refresh the table when returning from edit
ionViewWillEnter() {
  this.loadRoles();
}

  editRole(role: Role) {
    if (role.id) {
      this.router.navigate(['/edit-role', role.id]);
    } else {
      console.error('Cannot edit role: Role ID is undefined');
    }
  }

  async deleteRole(role: Role) {
    if (!role.id) {
      console.error('Cannot delete role: Role ID is undefined');
      return;
    }

    if (confirm('Are you sure you want to delete this role?')) {
      try {
        await this.rolesService.deleteRole(role.id);
      } catch (error) {
        console.error('Error deleting role: ', error);
      }
    }
  }

  filterRoles(): Role[] {
    let filtered = this.roles.filter(role => {
      const searchTerm = this.searchTerm.toLowerCase();
      const roleName = role.name?.toLowerCase() || '';
      const description = role.description?.toLowerCase() || '';
      
      return roleName.includes(searchTerm) || 
             description.includes(searchTerm);
    });

    if (this.sortColumn) {
      filtered = this.sortRoles(filtered);
    }

    return filtered;
  }

  sortRoles(roles: Role[]): Role[] {
    return [...roles].sort((a, b) => {
      const valA = a[this.sortColumn as keyof Role] || '';
      const valB = b[this.sortColumn as keyof Role] || '';

      if (typeof valA === 'string' && typeof valB === 'string') {
        return this.sortDirection === 'asc' 
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      }
      return 0;
    });
  }

  toggleSort(column: string) {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
    this.filteredRoles = this.sortRoles(this.filteredRoles);
  }

  onSearchChange() {
    this.filteredRoles = this.filterRoles();
    this.currentPage = 1;
  }

  get paginatedRoles() {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = Math.min(startIndex + this.itemsPerPage, this.filteredRoles.length);
    return this.filteredRoles.slice(startIndex, endIndex);
  }

  get totalPages() {
    return Math.ceil(this.filteredRoles.length / this.itemsPerPage);
  }

  previousPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  addRole() {
    this.router.navigate(['/add-roles']);
  }

  getPageNumbers(): number[] {
    const pages: number[] = [];
    const maxVisiblePages = 5;
    const halfVisible = Math.floor(maxVisiblePages / 2);

    let startPage = Math.max(1, this.currentPage - halfVisible);
    let endPage = Math.min(this.totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      if (this.currentPage < halfVisible) {
        endPage = Math.min(maxVisiblePages, this.totalPages);
      } else {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
      }
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return pages;
  }
}