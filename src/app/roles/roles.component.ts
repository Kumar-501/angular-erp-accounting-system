import { Component } from '@angular/core';
import { RolesService } from '../services/roles.service';
import { Router } from '@angular/router';  // Make sure to import the Router


@Component({
  selector: 'app-roles',
  templateUrl: './roles.component.html',
  styleUrls: ['./roles.component.scss']
})
export class RolesComponent {
  roleName: string = '';
  permissions = {
    others: {
      selectAll: false,
      exportButtons: false
    },
    user: {
      selectAll: false,
      view: false,
      add: false,
      edit: false,
      delete: false
    },
    roles: {
      selectAll: false,
      view: false,
      add: false,
      edit: false,
      delete: false
    },
    supplier: {
      selectAll: false,
      viewAll: false,
      viewOwn: false,
      add: false,
      edit: false,
      delete: false
    },
    customer: {
      selectAll: false,
      viewAll: false,
      viewOwn: false,
      viewNoSell1Month: false,
      viewNoSell3Months: false,
      viewNoSell6Months: false,
      viewNoSell1Year: false,
      viewIrrespectiveSell: false,
      add: false,
      edit: false,
      delete: false
    },
    product: {
      selectAll: false,
      view: false,
      add: false,
      edit: false,
      delete: false,
      addOpeningStock: false,
      viewPurchasePrice: false
    },
    purchaseStock: {
      selectAll: false,
      viewAll: false,
      viewOwn: false,
      add: false,
      edit: false,
      delete: false,
      addPayment: false,
      editPayment: false,
      deletePayment: false,
      updateStatus: false
    },
    purchaseRequisition: {
      selectAll: false,
      viewAll: false,
      viewOwn: false,
      create: false,
      delete: false
    },
    purchaseOrder: {
      selectAll: false,
      viewAll: false,
      viewOwn: false,
      create: false,
      edit: false,
      delete: false
    },
    pos: {
      selectAll: false,
      editSell: false,
      deleteSell: false,
      editPrice: false,
      editDiscount: false,
      addEditPayment: false,
      printInvoice: false,
      disableMultiplePay: false,
      disableDraft: false,
      disableExpressCheckout: false,
      disableDiscount: false,
      disableSuspendSale: false,
      disableCreditSale: false,
      disableQuotation: false,
      disableCard: false
    },
    sell: {
      selectAll: false,
      viewAll: false,
      viewOwn: false,
      viewPaid: false,
      viewDue: false,
      viewPartiallyPaid: false,
      viewOverdue: false,
      add: false,
      update: false,
      delete: false,
      commissionAgentView: false,
      addPayment: false,
      editPayment: false,
      deletePayment: false,
      editPrice: false,
      editDiscount: false,
      manageDiscount: false,
      accessServiceTypes: false,
      accessAllReturns: false,
      accessOwnReturns: false,
      manageInvoiceNumber: false
    },
    salesOrder: {
      selectAll: false,
      viewAll: false,
      viewOwn: false,
      create: false,
      edit: false,
      delete: false
    },
    draft: {
      selectAll: false,
      viewAll: false,
      viewOwn: false,
      edit: false,
      delete: false
    },
    quotation: {
      selectAll: false,
      viewAll: false,
      viewOwn: false,
      edit: false,
      delete: false
    },
    shipments: {
      selectAll: false,
      accessAll: false,
      accessOwn: false,
      accessPending: false,
      commissionAgentAccess: false
    },
    cashRegister: {
      selectAll: false,
      view: false,
      close: false
    },
    brand: {
      selectAll: false,
      view: false,
      add: false,
      edit: false,
      delete: false
    },
    taxRate: {
      selectAll: false,
      view: false,
      add: false,
      edit: false,
      delete: false
    },
    unit: {
      selectAll: false,
      view: false,
      add: false,
      edit: false,
      delete: false
    },
    category: {
      selectAll: false,
      view: false,
      add: false,
      edit: false,
      delete: false
    },
    report: {
      selectAll: false,
      purchaseSell: false,
      tax: false,
      supplierCustomer: false,
      expense: false,
      profitLoss: false,
      stock: false,
      trendingProduct: false,
      register: false,
      salesRepresentative: false,
      productStockValue: false
    },
    settings: {
      selectAll: false,
      business: false,
      barcode: false,
      invoice: false,
      printers: false
    },
    expense: {
      selectAll: false,
      accessAll: false,
      viewOwn: false,
      add: false,
      edit: false,
      delete: false
    },
    home: {
      selectAll: false,
      viewData: false
    },
    account: {
      selectAll: false,
      access: false,
      editTransaction: false,
      deleteTransaction: false,
      sellingPriceGroups: false,
      defaultSellingPrice: false
    },
    crm: {
      selectAll: false,
      allFollowUp: false,
      ownFollowUp: false,
      allLeads: false,
      ownLeads: false,
      allCampaigns: false,
      ownCampaigns: false,
      contactLogin: false,
      sources: false,
      lifeStage: false,
      proposal: false
    },
    superadmin: {
      selectAll: false,
      packageSubscriptions: false
    }
  };
  constructor(
    private rolesService: RolesService,
    private router: Router   // Injecting the Router service to navigate to different routes
  ) {
  }
  

  toggleSelectAll(section: string) {
    const permissionGroup = this.permissions[section as keyof typeof this.permissions];

    if (permissionGroup) {
      const state = permissionGroup.selectAll;
      Object.keys(permissionGroup).forEach(key => {
        if (key !== 'selectAll') {
          (permissionGroup as any)[key] = state;
        }
      });
    }
  }

  onPermissionChange(section: string) {
    const permissionGroup = this.permissions[section as keyof typeof this.permissions];

    if (permissionGroup) {
      let allChecked = true;
      Object.keys(permissionGroup).forEach(key => {
        if (key !== 'selectAll' && !(permissionGroup as any)[key]) {
          allChecked = false;
        }
      });

      permissionGroup.selectAll = allChecked;
    }
  }
  

  onSubmit() {
    console.log('Role Name:', this.roleName);
    console.log('Permissions:', this.permissions);

    // Call the service to save the role and permissions to Firestore
    this.rolesService.saveRole(this.roleName, this.permissions).then(() => {
      console.log('Role saved successfully!');
    }).catch((error) => {
      console.error('Error saving role:', error);
    });
this.router.navigate(['/roles-table']);

  }
}
