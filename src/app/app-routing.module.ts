import { Component, NgModule } from '@angular/core';
import { AuthGuard } from './auth.guard';

import { RouterModule, Routes } from '@angular/router';
import { WarrantiesComponent } from './warranties/warranties.component';
import { BrandsComponent } from './brands/brands.component';
import { CategoriesComponent } from './categories/categories.component';
import { UnitsComponent } from './units/units.component';
import { SellingPriceComponent } from './selling-price/selling-price.component';
import { VariationsComponent } from './variations/variations.component';
import { AddProductComponent } from './add-product/add-product.component';
import { ListProductsComponent } from './list-products/list-products.component';
import { UpdatePriceComponent } from './update-price/update-price.component';
import { ImportProductsComponent } from './import-products/import-products.component';
import { ImportOpeningComponent } from './import-opening/import-opening.component';
import { PurchaseOrderComponent } from './purchase-order/purchase-order.component';
import { AddPurchaseComponent } from './add-purchase/add-purchase.component';
import { PurchaseRequisitionComponent } from './purchase-requisition/purchase-requisition.component';
import { AddPurchaseRequisitionComponent } from './add-purchase-requisition/add-purchase-requisition.component';
import { PrintLabelsComponent } from './print-labels/print-labels.component';
import { ListPurchaseComponent } from './list-purchase/list-purchase.component';
import { PurchaseReturnComponent } from './purchase-return/purchase-return.component';
import { SalesOrderComponent } from './sales-order/sales-order.component';
import { AddSaleComponent } from './add-sale/add-sale.component';
import { AddDraftComponent } from './add-draft/add-draft.component';
import { ListDraftComponent } from './list-draft/list-draft.component';
import { AddQuotationComponent } from './add-quotation/add-quotation.component';
import { ListQuotationsComponent } from './list-quotations/list-quotations.component';
import { SellReturnComponent } from './sell-return/sell-return.component';
import { ImportSalesComponent } from './import-sales/import-sales.component';
import { DiscountComponent } from './discount/discount.component';
import { AddPurchaseOrderComponent } from './add-purchase-order/add-purchase-order.component';
import { ShipmentsComponent } from './shipments/shipments.component';
import { SuppliersComponent } from './suppliers/suppliers.component';
import { CustomersComponent } from './customers/customers.component';
import { ListAdjustmentComponent } from './list-adjustment/list-adjustment.component';
import { AddAdjustmentComponent } from './add-adjustment/add-adjustment.component';
import { ListStockComponent } from './list-stock/list-stock.component';
import { AddStockComponent } from './add-stock/add-stock.component';
import { ListExpensesComponent } from './list-expenses/list-expenses.component';
import { AddExpenseComponent } from './add-expense/add-expense.component';
import { ExpenseCategoriesComponent } from './expense-categories/expense-categories.component';
import { SalesComponent } from './sales/sales.component';
import { CustomerGroupComponent } from './customer-group/customer-group.component';
import { ImportContactsComponent } from './import-contacts/import-contacts.component';
import { EditStockComponent } from './edit-stock/edit-stock.component';
import { EditAdjustmentComponent } from './edit-adjustment/edit-adjustment.component';
import { SalesOrderDetailComponent } from './sales-order-detail/sales-order-detail.component';
import { ViewPurchaseRequisitionComponent } from './view-purchase-requisition/view-purchase-requisition.component';
import { PurchaseOrderViewComponent } from './purchase-order-view/purchase-order-view.component';
import { ViewPurchaseComponent } from './purchase/view-purchase/view-purchase.component';
import { UsersComponent } from './users/users.component';
import { AddUsersComponent } from './add-users/add-users.component';
import { EditUserComponent } from './edit-user/edit-user.component';
import { RolesTableComponent } from './roles-table/roles-table.component';
import { SalesAgentsComponent } from './sales-agents/sales-agents.component';
import { ViewExpenseComponent } from './view-expense/view-expense.component';
import { ListAccountsComponent } from './list-accounts/list-accounts.component';
import { TrialBalanceComponent } from './trial-balance/trial-balance.component';
import { CashFlowComponent } from './cash-flow/cash-flow.component';
import { PaymentReportComponent } from './payment-report/payment-report.component';
import { BalanceSheetComponent } from './balance-sheet/balance-sheet.component';
import { BusinessSettingsComponent } from './business-settings/business-settings.component';
import { BusinessLocationsComponent } from './business-locations/business-locations.component';
import { InvoiceSettingsComponent } from './invoice-settings/invoice-settings.component';
import { BarcodesComponent } from './barcodes/barcodes.component';
import { PrintersComponent } from './printers/printers.component';
import { TaxComponent } from './tax/tax.component';
import { ModifierComponent } from './modifier/modifier.component';
import { TypeOfServiceComponent } from './type-of-service/type-of-service.component';
import { PackageSubscriptionComponent } from './package-subscription/package-subscription.component';
import { AddBarcodesComponent } from './add-barcodes/add-barcodes.component';
import { AddPrintersComponent } from './add-printers/add-printers.component';
import { ShipmentDetailsComponent } from './shipment-details/shipment-details.component';
import { CrmComponent } from './crm/crm.component';
import { LeadsComponent } from './crm/leads/leads.component';
import { FollowsUpComponent } from './crm/follows-up/follows-up.component';
import { FollowupCategoryComponent } from './crm/followup-category/followup-category.component';
import { LifeStageComponent } from './crm/life-stage/life-stage.component';
import { SourcesComponent } from './crm/sources/sources.component';
import { CreateComponent } from './crm/create/create.component';
import { EditPurchaseComponent } from './edit-purchase/edit-purchase.component';
import { EditPurchaseOrderComponent } from './edit-purchase-order/edit-purchase-order.component';
import { LoginComponent } from './login/login.component';
import { RegisterComponent } from './register/register.component';
import { OpeningStockComponent } from './opening-stock/opening-stock.component';
import { StockReportComponent } from './stock-report/stock-report.component';
import { EditSaleComponent } from './edit-sale/edit-sale.component';
import { HrmComponent } from './hrm/hrm.component';
import { LeaveTypeComponent } from './hrm/leave-type/leave-type.component';
import { LeaveComponent } from './hrm/leave/leave.component';
import { AttendanceComponent } from './hrm/attendance/attendance.component';
import { PayrollComponent } from './hrm/payroll/payroll.component';
import { HolidayComponent } from './hrm/holiday/holiday.component';
import { DepartmentsComponent } from './hrm/departments/departments.component';
import { DesignationsComponent } from './hrm/designations/designations.component';
import { SalesTargetsComponent } from './hrm/sales-targets/sales-targets.component';
import { SettingsComponent } from './hrm/settings/settings.component';
import { ViewEntryComponent } from './view-entry/view-entry.component';
import { AccountBookComponent } from './account-book/account-book.component';
import { AddPayrollComponent } from './add-payroll/add-payroll.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { PackingSlipComponent } from './packing-slip/packing-slip.component';
import { CrmDashboardComponent } from './crm/crm-dashboard/crm-dashboard.component';
import { AddRolesComponent } from './add-roles/add-roles.component';
import { CustomerDetailComponent } from './customer-detail/customer-detail.component';
import { CrmSettingsComponent } from './crm/crm-settings/crm-settings.component';
import { ProductHistoryComponent } from './product-history/product-history.component';
import { EditProductComponent } from './edit-product/edit-product.component';
import { AddCustomerComponent } from './add-customer/add-customer.component';
import { EditCustomerComponent } from './edit-customer/edit-customer.component';
import { LedgerViewComponent } from './ledger-view/ledger-view.component';
import { SupplierPurchaseComponent } from './supplier-purchase/supplier-purchase.component';
import { PaymentHistoryComponent } from './payment-history/payment-history.component';
import { SupplierPurchasesComponent } from './supplier-purchases/supplier-purchases.component';
import { SupplierViewComponent } from './supplier-view/supplier-view.component';
import { SalesCallComponent } from './crm/sales-call/sales-call.component';
import { SalesCustomersComponent } from './crm/sales-customers/sales-customers.component';
import { CustomerViewComponent } from './customer-view/customer-view.component';
import { DepartmentCountComponent } from './crm/department-count/department-count.component';
import { FollowFormComponent } from './follow-form/follow-form.component';
import { EditRoleComponent } from './edit-role/edit-role.component';
import { PpServicePopupComponent } from './pp-service-popup/pp-service-popup.component';
import { CodPopupComponent } from './cod-popup/cod-popup.component';
import { User1Component } from './user1/user1.component';
import { SalesViewComponent } from './sales-view/sales-view.component';
import { AddGinTransferComponent } from './add-gin-transfer/add-gin-transfer.component';
import { ListGinTransfersComponent } from './list-gin-transfers/list-gin-transfers.component';
import { ListGoodsComponent } from './list-goods/list-goods.component';
import { AddGoodsComponent } from './add-goods/add-goods.component';
import { ProductSellReportComponent } from './product-sell-report/product-sell-report.component';
import { ImportShippingComponent } from './import-shipping/import-shipping.component';
import { SummaryReportComponent } from './summary-report/summary-report.component';
import { SaleSummaryComponent } from './sale-summary/sale-summary.component';
import { EditGinTransferComponent } from './edit-gin-transfer/edit-gin-transfer.component';
import { LeadViewComponent } from './lead-view/lead-view.component';
import { GinTransferViewComponent } from './gin-transfer-view/gin-transfer-view.component';
import { LeadAddComponent } from './crm/lead-add/lead-add.component';
import { PrescriptionFormComponent } from './prescription-form/prescription-form.component';
import { ProfitLossComponent } from './profit-loss/profit-loss.component';
import { SupplierDetailsComponent } from './supplier-details/supplier-details.component';
import { PurchaseDataComponent } from './purchase-data/purchase-data.component';
import { StockDetailsComponent } from './stock-details/stock-details.component';
import { ProductHistoryService } from './services/product-history.service';
import { ProductPurchaseDetailsComponent } from './product-purchase-details/product-purchase-details.component';
import { ProductSalesComponent } from './product-sales/product-sales.component';
import { ShoppingComponent } from './shopping/shopping.component';
import { PaycashDetailsComponent } from './paycash-details/paycash-details.component';
import { ReportsComponent } from './reports/reports.component';
import { ShippingSummaryComponent } from './shipping-summary/shipping-summary.component';
import { ExpenseReportsComponent } from './reports/expense-reports/expense-reports.component';
import { ListReportComponent } from './list-report/list-report.component';
import { OutstandingReportComponent } from './outstanding-report/outstanding-report.component';
import { CustomerSummaryComponent } from './customer-summary/customer-summary.component';
import { SalesInvoiceComponent } from './sales-invoice/sales-invoice.component';
import { SupplierSummaryComponent } from './supplier-summary/supplier-summary.component';
import { ProductSellComponent } from './product-sell/product-sell.component';
import { SalesReturnComponent } from './sales-return/sales-return.component';
import { ProductSalesReportComponent } from './product-sales-report/product-sales-report.component';
import { InputTaxReportComponent } from './input-tax-report/input-tax-report.component';
import { OutputTaxReportComponent } from './output-tax-report/output-tax-report.component';
import { SupplierReportComponent } from './supplier-report/supplier-report.component';
import { ExpenseDataComponent } from './expense-data/expense-data.component';
import { ExpenseOrdersComponent } from './expense-orders/expense-orders.component';
import { LeadsReportComponent } from './leads-report/leads-report.component';
import { LeadsReportsComponent } from './leads-reports/leads-reports.component';
import { CustomerReportComponent } from './customer-report/customer-report.component';
import { SellReturnReportComponent } from './sell-return-report/sell-return-report.component';

const routes: Routes = [

{path:'warranties',component:WarrantiesComponent},
{path:'brands',component:BrandsComponent},
{path:'categories',component:CategoriesComponent},
{path:'units',component:UnitsComponent},
{path:'selling-price',component:SellingPriceComponent},
{path:'variations',component:VariationsComponent},
{path:'add-product',component:AddProductComponent},
{path:'list-products',component:ListProductsComponent},
{path:'update-price',component:UpdatePriceComponent},
{path:'import-products',component:ImportProductsComponent},
{path:'import-opening',component:ImportOpeningComponent},
  { path: 'purchase-order', component: PurchaseOrderComponent },
{path:'profit-loss',component:ProfitLossComponent},
{path:'add-purchase',component:AddPurchaseComponent},
{path:'purchase-requisition',component:PurchaseRequisitionComponent},
{ path: 'add-purchase-requisition', component: AddPurchaseRequisitionComponent},
{path:'print-labels',component:PrintLabelsComponent},
{path:'list-purchase',component:ListPurchaseComponent},
{path:'purchase-return',component:PurchaseReturnComponent},
{path:'sales-order',component:SalesOrderComponent},
{ path: 'edit-gin-transfer/:id', component: EditGinTransferComponent},
{path:'add-sale',component:AddSaleComponent},
{path:'add-draft',component:AddDraftComponent},
{path:'sales-order',component:SalesOrderComponent},
  { path: 'sales-view/:id', component: SalesViewComponent },
{path:'supplier-report',component:SupplierReportComponent},
  { path: 'list-draft', component: ListDraftComponent },
{path:'add-quotation',component:AddQuotationComponent},
{path:'list-quotations',component:ListQuotationsComponent},
{path:'sell-return',component:SellReturnComponent},
{path:'import-sales',component:ImportSalesComponent},
{path:'discount',component:DiscountComponent},
{path:'add-purchase-order',component:AddPurchaseOrderComponent},
{ path:'shipments',component:ShipmentsComponent},
{path:'suppliers',component:SuppliersComponent},
{path:'customers',component:CustomersComponent},
{path:'list-adjustment',component:ListAdjustmentComponent},
{path:'add-adjustment',component:AddAdjustmentComponent},
{path:'list-adjustment',component:ListAdjustmentComponent},
{path:'list-stock',component:ListStockComponent},
{path:'sales-agents',component:SalesAgentsComponent},
{path:'customer-detail',component:CustomerDetailComponent},
{path:'add-stock',component:AddStockComponent},
{path:'list-expenses',component:ListExpensesComponent},
{path:'add-expense',component:AddExpenseComponent},
{path:'expense-categories',component:ExpenseCategoriesComponent},
{path:'sales',component:SalesComponent},
{path:'customer-group',component:CustomerGroupComponent},
{path:'import-contacts',component:ImportContactsComponent},
{path:'edit-stock/:id',component:EditStockComponent},
  { path: 'edit-adjustment/:id', component: EditAdjustmentComponent },
{path:'purchase-data',component:PurchaseDataComponent},
{ path: 'sales/view/:id', component: SalesOrderDetailComponent},
{ path: 'view-purchase-requisition/:id', component: ViewPurchaseRequisitionComponent},
{ path: 'purchase-orders/view/:id', component: PurchaseOrderViewComponent},
{ path: 'view-purchase/:id', component: ViewPurchaseComponent},
{path:'users',component:UsersComponent},
{path:'add-users',component:AddUsersComponent},
{path:'add-gin-transfer',component:AddGinTransferComponent},
{ path: 'edit-user/:id', component: EditUserComponent},
{ path: 'products/edit/:id', component: EditProductComponent },
{path:'roles-table',component:RolesTableComponent},
{path:'add-roles',component:AddRolesComponent},
{ path: 'view-expense/:id', component: ViewExpenseComponent},
{path:'list-accounts',component:ListAccountsComponent},
{path:'trial-balance',component:TrialBalanceComponent},
{path:'cash-flow',component:CashFlowComponent},
{path:'payment-report',component:PaymentReportComponent},
{path:'balance-sheet',component:BalanceSheetComponent},
  { path: 'business-settings', component: BusinessSettingsComponent },
{path:'product-sales-report',component:ProductSalesReportComponent},
{path:'business-locations',component:BusinessLocationsComponent},
{path:'invoice-settings',component:InvoiceSettingsComponent},
{path:'barcodes',component:BarcodesComponent},
{path:'printers',component:PrintersComponent},
{path:'tax',component:TaxComponent},
{path:'modifier',component:ModifierComponent},
{path:'type-of-service',component:TypeOfServiceComponent},
{path:'package-subscription',component:PackageSubscriptionComponent},
{path:'add-barcodes',component:AddBarcodesComponent},
{path:'add-printers',component:AddPrintersComponent},
{path:'shipments/view/:id',component:ShipmentDetailsComponent},
{ path: 'edit-purchase/:id', component: EditPurchaseComponent},
{ path: 'edit-purchase-order/:id', component: EditPurchaseOrderComponent },
{path:'login',component:LoginComponent},
{ path: 'sales-order/edit/:id', component: EditSaleComponent },
{path:'edit-purchase',component:EditPurchaseComponent},
{ path: 'register', component: RegisterComponent},
{path:'warranties',component:WarrantiesComponent},
{path:'opening-stock',component:OpeningStockComponent
  },
  {path:'expenses-report',component:ExpenseReportsComponent},
// In your app-routing.module.ts
{
  path: 'suppliers/:id/payments',
  component: SupplierPurchasesComponent,
  data: { tab: 'payments' }
  },
  { path: 'shipping-summary', component: ShippingSummaryComponent },
  { path: 'list-report', component: ListReportComponent },
  { path: 'outstanding-report',component:OutstandingReportComponent},
{path:'reports',component:ReportsComponent},
{path:'summary-report',component:SummaryReportComponent},
{path:'import-shipping',component:ImportShippingComponent},
{path:'product-sell-report',component:ProductSellReportComponent},
{ path: 'shipments/packing-slip/:id', component: PackingSlipComponent },
{path:'dashboard',component:DashboardComponent},
{path:'add-goods',component:AddGoodsComponent},
{path:'list-goods',component:ListGoodsComponent},
{ path: 'account-book/:id', component: AccountBookComponent },
  { path: 'stock-report', component: StockReportComponent },
 {path:'paycash-details',component:PaycashDetailsComponent},
{path:'customer-summary',component:CustomerSummaryComponent},
{ path: 'view-entry/:type/:id', component: ViewEntryComponent },
{path:'balance-sheet',component:BalanceSheetComponent},
{ path: '', redirectTo: 'login', pathMatch: 'full' },
{path:'add-payroll',component:AddPayrollComponent},
{ path: 'product-history/:id', component: ProductHistoryComponent },
{path:'payment-history',component:PaymentHistoryComponent},
{ path: 'edit-product/:id', component: EditProductComponent },
{ path: 'suppliers/:id/ledger', component: LedgerViewComponent },
{ path: 'suppliers/:id', component: SupplierViewComponent},
{path:'pp-service-popup',component:PpServicePopupComponent},
  { path: 'lead/:id', component: LeadViewComponent },
  {path:'sales-invoice',component:SalesInvoiceComponent},
{path:'supplier-summary',component:SupplierSummaryComponent},
{path:'cod-popup',component:CodPopupComponent},
{path:'stock-report',component:StockReportComponent},
  { path: 'summary-report', component: SummaryReportComponent },
{path:'product-sell',component:ProductSellComponent},
{path:'sale-summary',component:SaleSummaryComponent},
{path: 'gin-transfer-view/:id', // Assuming 'id' is the GIN Transfer ID
    component: GinTransferViewComponent
  },
  {
  path: 'product-details/:id',
  component: ProductPurchaseDetailsComponent,
  data: { title: 'Product Details' }
},
  { path: 'product-sales', component: ProductSalesComponent },
  { path: 'shopping', component: ShoppingComponent },
{path:'input-tax-report',component:InputTaxReportComponent},
{path:'sell-return-report',component:SellReturnReportComponent},
{ 
  path: 'purchase-orders/edit/:id', 
  component: EditPurchaseOrderComponent 
  },
  {path:'customer-report',component:CustomerReportComponent},
{path:'expense-orders',component:ExpenseOrdersComponent},
  { path: 'edit-role/:id', component: EditRoleComponent },
  { path: 'leads-reports', component: LeadsReportsComponent },
{
  path: 'suppliers/:id/purchases',
  component:SupplierPurchasesComponent
},
{path:'expense-data',component:ExpenseDataComponent},
  { path: 'add-gin-transfer', component: AddGinTransferComponent },
{path:'sales-return',component:SalesReturnComponent},
  { path: 'list-gin-transfers', component: ListGinTransfersComponent },
  { path: 'suppliers/:supplierId/purchases', component: SupplierPurchaseComponent },
  { path: 'follow-form', component: FollowFormComponent },
  { path: 'prescription-form', component: PrescriptionFormComponent },
  { path: 'supplier-details/:id', component: SupplierDetailsComponent },
  { path: 'stock-details/:id', component: StockDetailsComponent },
  {path:'output-tax-report',component:OutputTaxReportComponent},

{
  path: 'crm',
  component:CrmComponent,
  canActivate: [AuthGuard],

  children: [
    { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: CrmDashboardComponent},
    { path: 'leads', component: LeadsComponent },
 
    { path: 'follows-up', component:FollowsUpComponent},
    {path:'followup-category',component:FollowupCategoryComponent},
    {path:'life-stage',component:LifeStageComponent},
    {path:'sources',component:SourcesComponent},
    {path:'create',component:CreateComponent},
    {path:'crm-settings',component:CrmSettingsComponent},
    {path:'sales-call',component:SalesCallComponent},
    {path:'sales-customers',component:SalesCustomersComponent},
    { path: 'customers/view/:id', component: CustomerViewComponent },
    {path:'lead-add',component:LeadAddComponent},

    { 
      path: 'customer-edit-popup/:id', 
      component: AddSaleComponent,
      data: { showCustomerEdit: true } 
    },
    {path:'department-count',component:DepartmentCountComponent}
  ]
}
,

{ path: 'hrm', component: HrmComponent, children: [
  { path: 'leave-type', component: LeaveTypeComponent },
  { path: 'leave', component: LeaveComponent},
  { path: 'attendance', component: AttendanceComponent },
  { path: 'payroll', component: PayrollComponent },
  { path: 'holiday', component: HolidayComponent},
  { path: 'departments', component: DepartmentsComponent},
  { path: 'designations', component: DesignationsComponent},
  { path: 'sales-targets', component:SalesTargetsComponent },
  { path: 'settings', component:SettingsComponent},
  {path:'user1',component:User1Component},
  ]}









];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
