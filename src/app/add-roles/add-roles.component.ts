import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RolesService } from '../services/roles.service';

// Define the interface for component objects
interface ComponentPermission {
  component: string;
  displayName?: string;
}

@Component({
  selector: 'app-add-roles',
  templateUrl: './add-roles.component.html',
  styleUrls: ['./add-roles.component.scss']
})
export class AddRolesComponent implements OnInit {
  roleForm: FormGroup;
  isLoading = false;
  
  // Define the type explicitly and add some example components
  allComponents: ComponentPermission[] = [
    { component: 'dashboard', displayName: 'Dashboard' },
    { component: 'users', displayName: 'User Management' },
    { component: 'roles', displayName: 'Role Management' },
    { component: 'reports', displayName: 'Reports' },
    { component: 'settings', displayName: 'Settings' },
    // Add more components as needed
  ];

  constructor(
    private fb: FormBuilder,
    private rolesService: RolesService,
    private snackBar: MatSnackBar,
    private router: Router
  ) {
    this.roleForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      description: ['']
    });
  }

  ngOnInit(): void {}

  async onSubmit(): Promise<void> {
    if (this.roleForm.invalid) {
      this.snackBar.open('Please fill all required fields', 'Close', {
        duration: 3000
      });
      return;
    }

    this.isLoading = true;

    try {
      const permissions = this.createPermissionsObject();
      
      const roleData = {
        name: this.roleForm.value.name,
        description: this.roleForm.value.description,
        permissions: permissions,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await this.rolesService.createRole(roleData);
      this.snackBar.open('Role created successfully!', 'Close', { duration: 3000 });
      this.router.navigate(['/roles-table']);
    } catch (error) {
      console.error('Error creating role:', error);
      this.snackBar.open('Failed to create role. Please try again.', 'Close', { duration: 3000 });
    } finally {
      this.isLoading = false;
    }
  }

  private createPermissionsObject(): { [key: string]: any } {
    const permissions: { [key: string]: any } = {};
    
    this.allComponents.forEach(componentObj => {
      permissions[componentObj.component] = {
        view: true,
        create: true,
        edit: true,
        delete: true
      };
    });
    
    return permissions;
  }

  onClose(): void {
    this.router.navigate(['/roles-table']);
  }
}