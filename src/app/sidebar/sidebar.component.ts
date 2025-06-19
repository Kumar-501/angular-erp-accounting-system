import { Component, Input, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent implements OnInit {
  @Input() isOpen = true;
  filteredMenuItems: any[] = [];
  
  private allMenuItems = [
    {
      name: 'Home',
      icon: 'home',
      isExpanded: false,
      route: '/dashboard',
      roles: ['admin','executive','supervisor','logistics hod','logistics prepaid','logistics cod','auditing executives','accounts hod','sales hod','accounts executives','costing executives']
    },
    {
      name: 'User Management',
      icon: 'people',
      isExpanded: false,
      subItems: [
        { name: 'Users', route: '/users', roles: ['admin','hr manager'] },
        { name: 'Roles', route: '/roles-table', roles: ['admin'] },
        { name: 'Sales Commisions Agents', route: '/sales-agents', roles: ['admin','sales hod','supervisor'] },
      ],
      roles: ['admin', 'manager','human resource', 'hr manager','sales hod','supervisor','']
    },
    {
      name: 'Contacts',
      icon: 'contacts',
      isExpanded: false,
      subItems: [
        { name: 'Suppliers', route: '/suppliers', roles: ['admin', 'manager','costing executives','accounts hod','accounts executives', 'auditing executives'] },
                // { name: 'Ledger', route: '/shopping', roles: ['admin', 'manager','accounts executives', 'executive',,] },

        { name: 'Customers', route: '/customers', roles: ['admin', 'accounts hod','manager','accounts executives', 'costing executives','executive','sales hod', 'supervisor'] },
        // { name: 'Customer Groups', route: '/customer-group', roles: ['admin', 'manager','supervisor'] },
 
        //  { name: 'paycash details', route: '/paycash-details', roles: ['admin', ] },

 
 
        { name: 'Import Contacts', route: '/import-contacts', roles: ['admin','accounts hod','accounts hod','accounts executives', 'costing executives','sales hod','executive','supervisor'] }
      ],
      roles: ['admin', 'manager',  'supervisor','accounts executives','sales hod','accounts hod','costing executives','executive','auditing executives']
    },





    {
      name: 'Products',
      icon: 'inventory_2',
      isExpanded: false,
      subItems: [
        { name: 'List Products', route: '/list-products', roles: ['admin','logistics prepaid', 'logistics cod','logistics hod','accounts hod','sales hod','costing executives' , 'accounts executives','supervisor','auditing executives'] },

        { name: 'Add Product', route: '/add-product', roles: ['admin', 'accounts hod','manager','costing executives','purchase team'] },
        { name: 'Update Price', route: '/update-price', roles: ['admin', 'accounts hod','manager','purchase team'] },
              { name: 'Warranties', route: '/warranties', roles: ['admin','logistics prepaid','logistics cod','accounts hod','logistics hod','costing executives','accounts executives', 'sales hod', ,'auditing executives'] },

        { name: 'Variations', route: '/variations', roles: ['admin', 'manager','accounts hod','costing executives','purchase team'] },
        { name: 'Import Products', route: '/import-products', roles: ['admin','accounts hod','costing executives','purchase team','costing executives'] },
        { name: 'Import Opening Stock', route: '/import-opening', roles: ['admin','accounts hod',,'purchase team'] },
        { name: 'Units', route: '/units', roles: ['admin', 'manager','accounts hod',,'purchase team'] },
        { name: 'Categories', route: '/categories', roles: ['admin', 'manager','accounts hod',,'purchase team'] },
        { name: 'Brands', route: '/brands', roles: ['admin', 'manager','accounts hod',,'purchase team'] },


      ],
      roles: ['admin', 'manager',  'accounts hod','supervisor','logistics cod','logistics prepaid','logistics hod','costing executives','saleshod','accounts executives','auditing executives']
    },
    {
      name: 'Purchases',
      icon: 'shopping_cart',
      isExpanded: false,
      roles: ['admin', 'manager','logistics hod','logistics prepaid', 'accountant','logistics cod','costing executives','accounts executives','accounts hod','auditing executives'], // Accountant not included
      subItems: [
        { name: 'Purchase Requisition', route: '/purchase-requisition', roles: ['admin','logistics hod', 'logistics prepaid','logistics cod','manager', 'executive','accountant','accounts hod','costing executives','supervisor','auditing executives'] },
        { name: 'Purchase Order', route: '/purchase-order', roles: ['admin','logistics prepaid', 'manager','logistics hod','logistics cod', 'executive','accountant','accounts hod','costing executives','supervisor','auditing executives'] },
        { name: 'List Purchases', route: '/list-purchase', roles: ['admin','logistics prepaid', 'manager','logistics hod','logistics cod','costing executives', 'executive','accounts hod','accountant','supervisor','auditing executives'] },
        { name: 'Add Purchase', route: '/add-purchase', roles: ['admin', 'manager','logistics hod','logistics prepaid','logistics cod','accountant','costing executives','accounts hod','supervisor','purchase team'] },
        { name: 'List Purchase Return', route: '/purchase-return', roles: ['admin','logistics hod', 'logistics cod','manager','accountant','costing executives','accounts hod','supervisor','purchase team'] }
      ]
    },
    {
      name: 'Sell',
      icon: 'point_of_sale',
      isExpanded: false,
      
      subItems: [
        { name: 'Sales Order', route: '/sales-order', roles: ['admin', 'sales hod', 'accounts hod','executive','accounts executives', 'supervisor','auditing executives'] },
        { name: 'All sales', route: '/sales', roles: ['admin', 'sales hod','logistics hod','logistics cod','accounts executives','accounts hod','costing executives' , 'supervisor','auditing executives'] },
        { name: 'Add Sale', route: '/add-sale', roles: ['admin', 'manager','accounts executives','accounts hod', ,'sales team'] },
        { name: 'Shipments', route: '/shipments', roles: ['admin', 'auditing executives','logistics cod','logistics hod','accounts hod','accounts executives','sales team'] },
        { name: 'Discounts', route: '/discount', roles: ['admin', 'manager','accounts hod','sales team',] },
         { name: 'Import Shipping', route: '/import-shipping', roles: ['admin','logistics hod','logistics cod','costing executives','accounts hod','accounts executives', 'auditing executives'] },

        { name: 'Import Sales', route: '/import-sales', roles: ['admin' ,'accounts executives','accounts hod','sales team',]},
      ],
      roles: ['admin', 'manager',  'supervisor','logistics prepaid','sales hod','logistics cod','costing executives','logistics hod','accounts hod','accounts executives','executive','sales team']
    },
    {
      name: 'Stock Transfers',
      icon: 'swap_horiz',
      isExpanded: false,
      subItems: [
        { name: 'List Stock Transfers', route: '/list-stock', roles: ['admin', 'manager', 'supervisor'] },
        { name: 'Add Stock Transfer', route: '/add-stock', roles: ['admin', 'manager','supervisor'] }
      ],
      roles: ['admin', 'manager', ]
    },
    {
      name: 'Stock Adjustment',
      icon: 'adjust',
      isExpanded: false,
      subItems: [
        { name: 'List Stock Adjustments', route: '/list-adjustment', roles: ['admin', 'logistics prepaid','logistics hod','auditing executives','accounts hod','accounts executives','costing executives', 'supervisor'] },
        { name: 'Add Stock Adjustment', route: '/add-adjustment', roles: ['admin','logistics prepaid', 'logistics hod','manager','costing executives','accounts hod','accounts executives','supervisor'] }
      ],
      roles: ['admin', 'costing executives','logistics prepaid','logistics prepaid','accounts executives','accounts hod','logistics hod','auditing executives',]
    },
    {
      name: 'Logistics Module',
      icon: 'adjust',
      isExpanded: false,
      subItems: [
        { name: 'Add GIN Transfer', route: '/add-gin-transfer', roles: ['admin','logistics hod','logistics cod','logistics prepaid','costing executives','accounts hod','accounts executives','manager', ] },
        { name: 'List GIN Transfer', route: '/list-gin-transfers', roles: ['admin', 'logistics hod','logistics cod','logistics prepaid','costing executives','accounts hod','accounts executives','auditing executives',] },
        { name: 'Add Goods Received Notes', route: '/add-goods', roles: ['admin','accounts hod','logistics cod','logistics prepaid', 'logistics hod','manager',] },
        { name: 'List Goods Received Notes', route: '/list-goods', roles: ['admin','costing executives','logistics cod','logistics prepaid','logistics hod','accounts hod', 'manager',] },
        { name: 'Product Sell Report', route: '/product-sell-report', roles: ['admin', 'manager','logistics prepaid','logistics cod','supervisor'] },
        { name: 'Sale Shipping Summary', route: '/sale-summary', roles: ['admin', 'manager','logistics cod','logistics prepaid','logistics hod','supervisor'] },
        { name: 'Import Shipping', route: '/import-shipping', roles: ['admin', 'manager','supervisor'] },

        { name: 'Summary Report', route: '/summary-report', roles: ['admin', 'accounts hod','accounting executives','logistics prepaid','costing executives','sales hod','supervisor'] },

      ],
      roles: ['admin', 'manager','logistics hod','logistics prepaid','logistics cod','auditing executives','accounts executives', 'logistics hod','accounts hod','accounts hod','costing executives','sales hod','supervisor']
},
    {
      name: 'Expenses/Income',
      icon: 'receipt',
      isExpanded: false,
      roles: ['admin', 'auditing executives','accounts executives', 'accounts hod','accountant', ],
      subItems: [
        { name: 'List Expenses/List Income', route: '/list-expenses', roles: ['admin','accounts hod', 'auditing executives', 'accounts executives','accountant','supervisor'] },
        { name: 'Add Expense/Add Income', route: '/add-expense', roles: ['admin', 'manager', 'accountant','accounts hod','accounts executives','supervisor'] },
        { name: 'Expense Categories/Income Categories', route: '/expense-categories', roles: ['admin', 'manager','accounts hod','accounts executives', 'accountant','supervisor'] },

      ]
    },
    {
      name: 'Transact',
      icon: 'account_balance',
      isExpanded: false,
      roles: ['admin', 'manager','accounts executives','accounts hod','auditing executives', 'accountant',],
      subItems: [
        { name: 'List Accounts', route: '/list-accounts', roles: ['admin','accounts hod', 'auditing executives', 'accounts executives','accountant','supervisor'] },
        { name: 'Balance Sheet', route: '/balance-sheet', roles: ['admin', 'accounts hod','auditing executives', 'accountant','supervisor'] },
        { name: 'Trial Balance', route: '/trial-balance', roles: ['admin', 'accounts hod','auditing executives', 'accountant','supervisor'] },

       
        { name: 'Profit and Loss Report', route: '/profit-loss', roles: ['admin', 'manager', 'accounts hod','accountant','supervisor'] },

      ]
    },
      {
      name: 'Reports',
      icon: 'account_balance',
      isExpanded: false,
      roles: ['admin', 'manager', 'accountant','sales hod','logistics prepaid','logistics cod', 'costing executives','auditing executives','supervisor'],
      subItems: [
       
 { name: 'Shipping Summary', route: '/shipping-summary', roles: ['admin','logistics prepaid','costing executives','logistics cod', 'manager',] },
                { name: 'Expenses-Report', route: '/list-report', roles: ['admin','auditing executives','costing executives', 'manager','supervisor'] },
        { name: 'Outstanding Report', route: '/outstanding-report', roles: ['admin','sales hod','costing executives', 'manager','supervisor'] },
        { name: 'Stock Report', route: '/stock-report', roles: ['admin', 'manager','accounts hod','costing executives','sales hod','supervisor','purchase team'] },

        { name: 'Summary Report', route: '/summary-report', roles: ['admin', 'manager', 'logistics hod','costing executives','accounts hod','supervisor'] },
         { name: 'Product Sell Report', route: '/product-sell-report', roles: ['admin','logistics cod','accounts hod','costing executives','logistics prepaid','logistics hod','sales hod', 'manager','supervisor'] },
        { name: 'Sale Shipping Summary', route: '/sale-summary', roles: ['admin', 'manager','accounts hod','costing executives','logistics cod','supervisor'] },
        { name: 'Customer Summary', route: '/customer-summary', roles: ['admin', 'manager','accounts hod','costing executives',,'sales hod' ,'supervisor'] },
                  { name: 'Sales-Invoice', route: '/sales-invoice', roles: ['admin', 'manager','accounts hod','sales hod','costing executives','auditing executives','supervisor'] },
        { name: 'Supplier Summary', route: '/supplier-summary', roles: ['admin', 'manager', 'accounts hod','costing executives','supervisor'] },
        { name: 'Product Sell By District', route: '/product-sell', roles: ['admin','auditing executives','costing executives', 'manager','supervisor'] },
        { name: 'Sell Return Report', route: '/sell-return-report', roles: ['admin','auditing executives','costing executives','accounts hod', 'manager', 'supervisor'] },

        { name: 'Input Tax Report', route: '/input-tax-report', roles: ['admin', 'manager','costing executives', 'supervisor'] },
                                { name: 'Output Tax Report', route: '/output-tax-report', roles: ['admin', 'manager','costing executives','supervisor'] },
     { name: 'Supplier Report', route: '/supplier-report', roles: ['admin', 'auditing executives','manager','costing executives','supervisor'] },
     { name: 'Leads Report', route: '/leads-reports', roles: ['admin', 'manager','supervisor'] },

     { name: 'Customer Report', route: '/customer-report', roles: ['admin','sales hod','accounts hod', 'costing executives','manager','supervisor'] },

        { name: 'Expense Orders', route: '/expense-orders', roles: ['admin','auditing executives','accounts hod','costing executives', 'manager', 'supervisor'] },


      ]
    },
    {
      name: 'Settings',
      icon: 'settings',
      isExpanded: false,
      subItems: [
        { name: 'Business Locations', route: '/business-locations', roles: ['admin', 'manager','supervisor'] },
        { name: 'Tax Rates', route: '/tax', roles: ['admin', 'manager','accounts hod','supervisor'] },
        { name: 'Types of Service', route: '/type-of-service', roles: ['admin', 'manager','supervisor'] },
      ],
      roles: ['admin', 'accounts hod','manager']
    },
    {
      name: 'CRM',
      icon: 'people',
      isExpanded: false,
      route: '/crm',
      roles: ['admin', 'auditing executives','sales team','sales hod','accounts hod', 'supervisor','executive'],
    },
    {
      name: 'HRM',
      icon: 'people',
      route: '/hrm',
      requiredPermissions: ['hrm.view'],
      roles: ['admin', 'auditing executives','accountant','costing executives','logistics cod','logistics prepaid','logistics hod','costing executives','accounts hod','accounts executives','sales hod','hr manager', 'supervisor','purchase team','executive'] // Accountant not included
    },
  

  ];
  
  constructor(private router: Router, private authService: AuthService) {}

  ngOnInit(): void {
    this.filterMenuItems();
  }

  private filterMenuItems(): void {
    const currentUser = this.authService.currentUserValue;
    if (!currentUser || !currentUser.role) {
      this.filteredMenuItems = [];
      return;
    }

    const userRole = currentUser.role.toLowerCase();
    
    this.filteredMenuItems = this.allMenuItems
      .filter(item => item.roles.includes(userRole))
      .map(item => {
        // Clone the item to avoid modifying the original
        const filteredItem = { ...item };
        
        // Filter subItems if they exist
        if (filteredItem.subItems && filteredItem.subItems.length > 0) {
          filteredItem.subItems = filteredItem.subItems.filter(subItem => 
            subItem.roles.includes(userRole)
          );
        }
        
        return filteredItem;
      });
  }

  handleMenuItemClick(item: any): void {
    if (item.subItems?.length) {
      // Only perform the closing of other menus if this menu is being opened
      // (not when it's being closed)
      if (!item.isExpanded) {
        // Close all other expanded items
        this.filteredMenuItems.forEach(menuItem => {
          if (menuItem !== item && menuItem.isExpanded) {
            menuItem.isExpanded = false;
          }
        });
      }
      
      // Toggle the clicked item
      item.isExpanded = !item.isExpanded;
    } else if (item.route) {
      // If it has a direct route, navigate
      this.router.navigate([item.route]);
    }
  }

  navigateTo(route: string): void {
    this.router.navigate([route]);
  }

  isActive(route?: string): boolean {
    if (!route) return false;
    return this.router.url === route;
  }

  hasActiveChild(item: any): boolean {
    if (!item.subItems) return false;
    return item.subItems.some((subItem: any) => this.isActive(subItem.route));
  }
}