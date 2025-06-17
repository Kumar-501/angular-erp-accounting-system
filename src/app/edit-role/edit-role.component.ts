import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RolesService, Role } from '../services/roles.service';

@Component({
  selector: 'app-edit-role',
  templateUrl: './edit-role.component.html',
  styleUrls: ['./edit-role.component.scss']
})
export class EditRoleComponent implements OnInit {
  roleForm: FormGroup;
  isLoading = false;
  roleId: string;
  currentRole: Role | null = null;
  
  // Import the complete list of components from the add-roles component
  allComponents = [
    { name: 'Warranties', component: 'WarrantiesComponent' },
    { name: 'Brands', component: 'BrandsComponent' },
    { name: 'Categories', component: 'CategoriesComponent' },
    { name: 'Units', component: 'UnitsComponent' },
    { name: 'Selling Price', component: 'SellingPriceComponent' },
    { name: 'Variations', component: 'VariationsComponent' },
    { name: 'Add Product', component: 'AddProductComponent' },
    { name: 'List Products', component: 'ListProductsComponent' },
    { name: 'Update Price', component: 'UpdatePriceComponent' },
    { name: 'Import Products', component: 'ImportProductsComponent' },
    { name: 'Import Opening', component: 'ImportOpeningComponent' },
    { name: 'Purchase Order', component: 'PurchaseOrderComponent' },
    { name: 'Add Purchase', component: 'AddPurchaseComponent' },
    { name: 'Purchase Requisition', component: 'PurchaseRequisitionComponent' },
    { name: 'Add Purchase Requisition', component: 'AddPurchaseRequisitionComponent' },
    { name: 'Print Labels', component: 'PrintLabelsComponent' },
    { name: 'List Purchase', component: 'ListPurchaseComponent' },
    { name: 'Purchase Return', component: 'PurchaseReturnComponent' },
    { name: 'Sales Order', component: 'SalesOrderComponent' },
    { name: 'Add Sale', component: 'AddSaleComponent' },
    { name: 'Add Draft', component: 'AddDraftComponent' },
    { name: 'List Draft', component: 'ListDraftComponent' },
    { name: 'Add Quotation', component: 'AddQuotationComponent' },
    { name: 'List Quotations', component: 'ListQuotationsComponent' },
    { name: 'Sell Return', component: 'SellReturnComponent' },
    { name: 'Import Sales', component: 'ImportSalesComponent' },
    { name: 'Discount', component: 'DiscountComponent' },
    { name: 'Add Purchase Order', component: 'AddPurchaseOrderComponent' },
    { name: 'Shipments', component: 'ShipmentsComponent' },
    { name: 'Suppliers', component: 'SuppliersComponent' },
    { name: 'Customers', component: 'CustomersComponent' },
    { name: 'List Adjustment', component: 'ListAdjustmentComponent' },
    { name: 'Add Adjustment', component: 'AddAdjustmentComponent' },
    { name: 'List Stock', component: 'ListStockComponent' },
    { name: 'Add Stock', component: 'AddStockComponent' },
    { name: 'List Expenses', component: 'ListExpensesComponent' },
    { name: 'Add Expense', component: 'AddExpenseComponent' },
    { name: 'Expense Categories', component: 'ExpenseCategoriesComponent' },
    { name: 'Sales', component: 'SalesComponent' },
    { name: 'Customer Group', component: 'CustomerGroupComponent' },
    { name: 'Import Contacts', component: 'ImportContactsComponent' },
    { name: 'Edit Stock', component: 'EditStockComponent' },
    { name: 'Edit Adjustment', component: 'EditAdjustmentComponent' },
    { name: 'Sales Order Detail', component: 'SalesOrderDetailComponent' },
    { name: 'View Purchase Requisition', component: 'ViewPurchaseRequisitionComponent' },
    { name: 'Purchase Order View', component: 'PurchaseOrderViewComponent' },
    { name: 'View Purchase', component: 'ViewPurchaseComponent' },
    { name: 'Users', component: 'UsersComponent' },
    { name: 'Add Users', component: 'AddUsersComponent' },
    { name: 'Edit User', component: 'EditUserComponent' },
    { name: 'Roles Table', component: 'RolesTableComponent' },
    { name: 'Roles', component: 'RolesComponent' },
    { name: 'Sales Agents', component: 'SalesAgentsComponent' },
    { name: 'View Expense', component: 'ViewExpenseComponent' },
    { name: 'List Accounts', component: 'ListAccountsComponent' },
    { name: 'Trial Balance', component: 'TrialBalanceComponent' },
    { name: 'Cash Flow', component: 'CashFlowComponent' },
    { name: 'Payment Report', component: 'PaymentReportComponent' },
    { name: 'Balance Sheet', component: 'BalanceSheetComponent' },
    { name: 'Business Settings', component: 'BusinessSettingsComponent' },
    { name: 'Business Locations', component: 'BusinessLocationsComponent' },
    { name: 'Invoice Settings', component: 'InvoiceSettingsComponent' },
    { name: 'Barcodes', component: 'BarcodesComponent' },
    { name: 'Printers', component: 'PrintersComponent' },
    { name: 'Tax', component: 'TaxComponent' },
    { name: 'Modifier', component: 'ModifierComponent' },
    { name: 'Type Of Service', component: 'TypeOfServiceComponent' },
    { name: 'Package Subscription', component: 'PackageSubscriptionComponent' },
    { name: 'Add Barcodes', component: 'AddBarcodesComponent' },
    { name: 'Add Printers', component: 'AddPrintersComponent' },
    { name: 'Shipment Details', component: 'ShipmentDetailsComponent' },
    { name: 'CRM', component: 'CrmComponent' },
    { name: 'Leads', component: 'LeadsComponent' },
    { name: 'Follows Up', component: 'FollowsUpComponent' },
    { name: 'Followup Category', component: 'FollowupCategoryComponent' },
    { name: 'Life Stage', component: 'LifeStageComponent' },
    { name: 'Sources', component: 'SourcesComponent' },
    { name: 'Create', component: 'CreateComponent' },
    { name: 'Edit Purchase', component: 'EditPurchaseComponent' },
    { name: 'Edit Purchase Order', component: 'EditPurchaseOrderComponent' },
    { name: 'Login', component: 'LoginComponent' },
    { name: 'Register', component: 'RegisterComponent' },
    { name: 'Opening Stock', component: 'OpeningStockComponent' },
    { name: 'Stock Report', component: 'StockReportComponent' },
    { name: 'Edit Sale', component: 'EditSaleComponent' },
    { name: 'HRM', component: 'HrmComponent' },
    { name: 'Leave Type', component: 'LeaveTypeComponent' },
    { name: 'Leave', component: 'LeaveComponent' },
    { name: 'Attendance', component: 'AttendanceComponent' },
    { name: 'Payroll', component: 'PayrollComponent' },
    { name: 'Holiday', component: 'HolidayComponent' },
    { name: 'Departments', component: 'DepartmentsComponent' },
    { name: 'Designations', component: 'DesignationsComponent' },
    { name: 'Sales Targets', component: 'SalesTargetsComponent' },
    { name: 'Settings', component: 'SettingsComponent' },
    { name: 'View Entry', component: 'ViewEntryComponent' },
    { name: 'Account Book', component: 'AccountBookComponent' },
    { name: 'Add Payroll', component: 'AddPayrollComponent' },
    { name: 'Dashboard', component: 'DashboardComponent' },
    { name: 'Packing Slip', component: 'PackingSlipComponent' },
    { name: 'CRM Dashboard', component: 'CrmDashboardComponent' },
    { name: 'Layout', component: 'LayoutComponent' }
  ];

  constructor(
    private fb: FormBuilder,
    private rolesService: RolesService,
    private snackBar: MatSnackBar,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.roleForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      description: ['']
    });
    
    this.roleId = this.route.snapshot.params['id'];
  }

  ngOnInit(): void {
    this.loadRoleData();
  }

  async loadRoleData(): Promise<void> {
    if (!this.roleId) {
      this.snackBar.open('Role ID is missing.', 'Close', { duration: 3000 });
      this.router.navigate(['/roles-table']);
      return;
    }

    try {
      this.isLoading = true;
      this.currentRole = await this.rolesService.getRoleById(this.roleId);
      
      if (this.currentRole) {
        // Prefill the form with existing data
        this.roleForm.patchValue({
          name: this.currentRole.name,
          description: this.currentRole.description || ''
        });
      } else {
        this.snackBar.open('Role not found.', 'Close', { duration: 3000 });
        this.router.navigate(['/roles-table']);
      }
    } catch (error) {
      console.error('Error loading role data:', error);
      this.snackBar.open('Failed to load role data.', 'Close', { duration: 3000 });
    } finally {
      this.isLoading = false;
    }
  }

async onSubmit(): Promise<void> {
  if (this.roleForm.invalid) {
    this.snackBar.open('Please fill all required fields', 'Close', { duration: 3000 });
    return;
  }

  this.isLoading = true;

  try {
    const permissions = this.createPermissionsObject();
    
    const roleData: Partial<Role> = {
      name: this.roleForm.value.name,
      description: this.roleForm.value.description,
      permissions: permissions
    };

    // Update the role
    await this.rolesService.updateRole(this.roleId, roleData);
    
    // Show success message
    this.snackBar.open('Role updated successfully!', 'Close', { duration: 3000 });
    
    // Navigate back after showing the success message
    setTimeout(() => {
      this.router.navigate(['/roles-table']);
    }, 500);
    
  } catch (error) {
    console.error('Error updating role:', error);
    this.snackBar.open('Failed to update role. Please try again.', 'Close', { duration: 3000 });
  } finally {
    this.isLoading = false;
  }
}

  private createPermissionsObject(): { [key: string]: any } {
    const permissions: { [key: string]: any } = {};
    
    // Give access to all components by default
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