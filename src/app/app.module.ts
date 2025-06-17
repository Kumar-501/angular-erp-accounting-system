import { importProvidersFrom, NgModule } from '@angular/core';
import { BrowserModule, provideClientHydration } from '@angular/platform-browser';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { NgxDaterangepickerMd } from 'ngx-daterangepicker-material';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { WarrantiesComponent } from './warranties/warranties.component';
import { MatDialogModule } from '@angular/material/dialog';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { ToastrModule } from 'ngx-toastr';
import { HttpClientModule } from '@angular/common/http';
import { MatTabsModule } from '@angular/material/tabs';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';


import { MatNativeDateModule } from '@angular/material/core';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';

import { AngularFireModule } from '@angular/fire/compat';           // AngularFire compat import

// ✅ Import RouterModule to fix "router-outlet" issue
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms'; 
import { MatIconModule } from '@angular/material/icon';
import { DatePipe } from '@angular/common';
import { CommonModule } from '@angular/common';  // Import this
import { MatCheckboxModule } from '@angular/material/checkbox';
// ✅ Import Firebase modules correctly
// Updated Firebase imports for AngularFire 18.0.1
import { provideFirebaseApp } from '@angular/fire/app';
import { initializeApp } from '@angular/fire/app';
import { provideFirestore } from '@angular/fire/firestore';  // ✅ Correct import

import { getFirestore } from '@angular/fire/firestore';



import { environment } from '../environments/environment';
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
import { NgxDatatableModule } from '@swimlane/ngx-datatable';
import { AddPurchaseRequisitionComponent } from './add-purchase-requisition/add-purchase-requisition.component';
import { HeaderComponent } from './header/header.component';
import { SidebarComponent } from './sidebar/sidebar.component';
import { LayoutComponent } from './layout/layout.component';
import { PrintLabelsComponent } from './print-labels/print-labels.component';
import { ListPurchaseComponent } from './list-purchase/list-purchase.component';
import { PurchaseReturnComponent } from './purchase-return/purchase-return.component';
import { MatTableModule } from '@angular/material/table';
import { SalesOrderComponent } from './sales-order/sales-order.component';
import { AddSaleComponent } from './add-sale/add-sale.component';
import { LedgerViewComponent } from './ledger-view/ledger-view.component';
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
import { AddStockComponent } from './add-stock/add-stock.component';
import { ListStockComponent } from './list-stock/list-stock.component';
import { AddExpenseComponent } from './add-expense/add-expense.component';
import { ListExpensesComponent } from './list-expenses/list-expenses.component';
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
import { BusinessLocationsComponent } from './business-locations/business-locations.component';
import { InvoiceSettingsComponent } from './invoice-settings/invoice-settings.component';
import { BarcodesComponent } from './barcodes/barcodes.component';
import { PrintersComponent } from './printers/printers.component';
import { TaxComponent } from './tax/tax.component';
import { ModifierComponent } from './modifier/modifier.component';
import { TypeOfServiceComponent } from './type-of-service/type-of-service.component';
import { PackageSubscriptionComponent } from './package-subscription/package-subscription.component';
import { BusinessSettingsComponent } from './business-settings/business-settings.component';
import { AddBarcodesComponent } from './add-barcodes/add-barcodes.component';
import { AddPrintersComponent } from './add-printers/add-printers.component';
import { ShipmentDetailsComponent } from './shipment-details/shipment-details.component';
import { CrmComponent } from './crm/crm.component';
import { LeadsComponent } from './crm/leads/leads.component';
import { FollowsUpComponent } from './crm/follows-up/follows-up.component';
import { SourcesComponent } from './crm/sources/sources.component';
import { LifeStageComponent } from './crm/life-stage/life-stage.component';
import { FollowupCategoryComponent } from './crm/followup-category/followup-category.component';
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
import { TruncatePipe } from './crm/leads/truncate.pipe';
import { AccountBookComponent } from './account-book/account-book.component';
import { EditRoleComponent } from './edit-role/edit-role.component';
import { AddPayrollComponent } from './add-payroll/add-payroll.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { PackingSlipComponent } from './packing-slip/packing-slip.component';
import { CrmDashboardComponent } from './crm/crm-dashboard/crm-dashboard.component';
import { AddRolesComponent } from './add-roles/add-roles.component';
import { UserDashboardComponent } from './user-dashboard/user-dashboard.component';
import { UserProfileComponent } from './user-profile/user-profile.component';
import { AttendanceListComponent } from './attendance-list/attendance-list.component';
import { AccountListComponent } from './account-list/account-list.component';
import { CustomerDetailComponent } from './customer-detail/customer-detail.component';
import { CrmSettingsComponent } from './crm/crm-settings/crm-settings.component';
import { FileSizePipe } from './crm/leads/file-size.pipe';
import { ProductHistoryComponent } from './product-history/product-history.component';
import { EditProductComponent } from './edit-product/edit-product.component';
import { SalesCallComponent } from './crm/sales-call/sales-call.component';
import { SalesCustomersComponent } from './crm/sales-customers/sales-customers.component';
import { CustomerViewComponent } from './customer-view/customer-view.component';
import { User1Component } from './user1/user1.component';
import { SupplierPurchasesComponent } from './supplier-purchases/supplier-purchases.component';
import { PpServicePopupComponent } from './pp-service-popup/pp-service-popup.component';
import { PaymentHistoryComponent } from './payment-history/payment-history.component';
import { FollowFormComponent } from './follow-form/follow-form.component';
import { EditCustomerComponent } from './edit-customer/edit-customer.component';
import { CodPopupComponent } from './cod-popup/cod-popup.component';
import { CustomerEditPopupComponent } from './customer-edit-popup/customer-edit-popup.component';
import { AddCustomerComponent } from './add-customer/add-customer.component';
import { SupplierViewComponent } from './supplier-view/supplier-view.component';
import { SalesViewComponent } from './sales-view/sales-view.component';
import { AddGinTransferComponent } from './add-gin-transfer/add-gin-transfer.component';
import { ListGinTransfersComponent } from './list-gin-transfers/list-gin-transfers.component';
import { AddGoodsComponent } from './add-goods/add-goods.component';
import { ListGoodsComponent } from './list-goods/list-goods.component';
import { ProductSellReportComponent } from './product-sell-report/product-sell-report.component';
import { SaleSummaryComponent } from './sale-summary/sale-summary.component';
import { ImportShippingComponent } from './import-shipping/import-shipping.component';
import { SummaryReportComponent } from './summary-report/summary-report.component';
import { EditGinTransferComponent } from './edit-gin-transfer/edit-gin-transfer.component';
import { LeadViewComponent } from './lead-view/lead-view.component';
import { GinTransferViewComponent } from './gin-transfer-view/gin-transfer-view.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { LeadAddComponent } from './crm/lead-add/lead-add.component';
import { PrescriptionFormprescriptionFormComponent } from './prescription-formprescription-form/prescription-formprescription-form.component';
import { PrescriptionFormComponent } from './prescription-form/prescription-form.component';
import { ProfitLossComponent } from './profit-loss/profit-loss.component';
import { SupplierDetailsComponent } from './supplier-details/supplier-details.component';
import { PurchaseDataComponent } from './purchase-data/purchase-data.component';
import { StockDetailsComponent } from './stock-details/stock-details.component';
import { ProductPurchaseDetailsComponent } from './product-purchase-details/product-purchase-details.component';
import { ProductSalesComponent } from './product-sales/product-sales.component';
import { ShoppingComponent } from './shopping/shopping.component';
import { ExpenseReportsComponent } from './reports/expense-reports/expense-reports.component';
import { PaymentDetailsComponent } from './payment-details/payment-details.component';
import { PaycashDetailsComponent } from './paycash-details/paycash-details.component';
import { ReportsComponent } from './reports/reports.component';
import { ShippingSummaryComponent } from './shipping-summary/shipping-summary.component';
import { ExpensesReportComponent } from './expenses-report/expenses-report.component';
import { ListReportComponent } from './list-report/list-report.component';
import { OutstandingReportComponent } from './outstanding-report/outstanding-report.component';
import { CustomerSummaryComponent } from './customer-summary/customer-summary.component';
import { SalesInvoiceComponent } from './sales-invoice/sales-invoice.component';
import { SupplierSummaryComponent } from './supplier-summary/supplier-summary.component';
import { ProductSellComponent } from './product-sell/product-sell.component';
import { SalesReturnComponent } from './sales-return/sales-return.component';
import { ProductSalesReportComponent } from './product-sales-report/product-sales-report.component';
import { AngularFirestoreModule } from '@angular/fire/compat/firestore';
import { InputTaxReportComponent } from './input-tax-report/input-tax-report.component';
import { OutputTaxReportComponent } from './output-tax-report/output-tax-report.component';
import { SupplierReportComponent } from './supplier-report/supplier-report.component';
import { ExpenseDataComponent } from './expense-data/expense-data.component';
import { ExpenseOrdersComponent } from './expense-orders/expense-orders.component';
import { LeadsReportComponent } from './leads-report/leads-report.component';
import { LeadsReportsComponent } from './leads-reports/leads-reports.component';
import { CustomerReportComponent } from './customer-report/customer-report.component';
import { SellReturnReportComponent } from './sell-return-report/sell-return-report.component';
import { BalanceComponent } from './balance/balance.component';
import { AccountBook1Component } from './account-book1/account-book1.component';
@NgModule({
  declarations: [
    AppComponent,
    WarrantiesComponent,
    BrandsComponent,
    CategoriesComponent,
    UnitsComponent,
    SellingPriceComponent,

    VariationsComponent,
    AddProductComponent,
    AddCustomerComponent,
    ListProductsComponent,
    UpdatePriceComponent,
    ImportProductsComponent,
    ImportOpeningComponent,
    PurchaseOrderComponent,
    AddPurchaseComponent,
    PaymentHistoryComponent,
    CustomerEditPopupComponent,
    PurchaseRequisitionComponent,
    AddPurchaseRequisitionComponent,
    HeaderComponent,
    EditCustomerComponent,
    CodPopupComponent,
    SidebarComponent,
    AddGinTransferComponent,

    LayoutComponent,
    PrintLabelsComponent,
    ListPurchaseComponent,
    PurchaseReturnComponent,
    SalesOrderComponent,
    AddSaleComponent,
    AddDraftComponent,
    LedgerViewComponent,
    ListDraftComponent,
    AddQuotationComponent,
    ListQuotationsComponent,
    SellReturnComponent,
    ImportSalesComponent,
    FollowFormComponent,
    DiscountComponent,
    AddPurchaseOrderComponent,
    ShipmentsComponent,
    SuppliersComponent,
    CustomersComponent,
  PpServicePopupComponent,
    ListAdjustmentComponent,
    AddAdjustmentComponent,
    AddStockComponent,
    ListStockComponent,
    AddExpenseComponent,
    ListExpensesComponent,
    ExpenseCategoriesComponent,
    SupplierViewComponent,
    SalesComponent,
    CustomerGroupComponent,
    ImportContactsComponent,
    EditStockComponent,
    EditAdjustmentComponent,
    SalesOrderDetailComponent,
    ViewPurchaseRequisitionComponent,
    PurchaseOrderViewComponent,
    ViewPurchaseComponent,
    UsersComponent,
    AddUsersComponent,
    EditUserComponent,
    RolesTableComponent,
    SalesAgentsComponent,
    ViewExpenseComponent,
    ListAccountsComponent,
    TrialBalanceComponent,
    CashFlowComponent,
    PaymentReportComponent,
    BalanceSheetComponent,
    BusinessLocationsComponent,
    InvoiceSettingsComponent,
    BarcodesComponent,
    PrintersComponent,
    TaxComponent,
    ModifierComponent,
    TypeOfServiceComponent,
    PackageSubscriptionComponent,
    BusinessSettingsComponent,
    AddBarcodesComponent,
    AddPrintersComponent,
    ShipmentDetailsComponent,
    CrmComponent,
    LeadsComponent,
    FollowsUpComponent,
    SourcesComponent,
    LifeStageComponent,
    FollowupCategoryComponent,
    CreateComponent,
    EditPurchaseComponent,
    EditPurchaseOrderComponent,
    LoginComponent,
    RegisterComponent,
    OpeningStockComponent,
    StockReportComponent,
    EditSaleComponent,
    HrmComponent,
    LeaveTypeComponent,
    LeaveComponent,
    AttendanceComponent,
    PayrollComponent,
    HolidayComponent,
    DepartmentsComponent,
    DesignationsComponent,
    SalesTargetsComponent,
    SettingsComponent,
    ViewEntryComponent,
    TruncatePipe,
    AccountBookComponent,
    EditRoleComponent,
    AddPayrollComponent,
    DashboardComponent,
    PackingSlipComponent,
    CrmDashboardComponent,
    AddRolesComponent,
    UserDashboardComponent,
    UserProfileComponent,
    AttendanceListComponent,
    AccountListComponent,
    CustomerDetailComponent,
    CrmSettingsComponent,
    FileSizePipe,
    ProductHistoryComponent,
    EditProductComponent,
    SalesCallComponent,
    SalesCustomersComponent,
    CustomerViewComponent,
    User1Component,
    SupplierPurchasesComponent,
    SalesViewComponent,
    ListGinTransfersComponent,
    AddGoodsComponent,
    ListGoodsComponent,
    ProductSellReportComponent,
    SaleSummaryComponent,
    ImportShippingComponent,
    SummaryReportComponent,
    EditGinTransferComponent,
    LeadViewComponent,
    GinTransferViewComponent,
    LeadAddComponent,
    PrescriptionFormprescriptionFormComponent,
    PrescriptionFormComponent,
    ProfitLossComponent,
    SupplierDetailsComponent,
    PurchaseDataComponent,
    StockDetailsComponent,
    ProductPurchaseDetailsComponent,
    ProductSalesComponent,
    ShoppingComponent,
    ExpenseReportsComponent,
    PaymentDetailsComponent,
    PaycashDetailsComponent,
    ReportsComponent,
    ShippingSummaryComponent,
    ExpensesReportComponent,
    ListReportComponent,
    OutstandingReportComponent,
    CustomerSummaryComponent,
    SalesInvoiceComponent,
    SupplierSummaryComponent,
    ProductSellComponent,
    SalesReturnComponent,
    ProductSalesReportComponent,
    InputTaxReportComponent,
    OutputTaxReportComponent,
    SupplierReportComponent,
    ExpenseDataComponent,
    ExpenseOrdersComponent,
    LeadsReportComponent,
    LeadsReportsComponent,
    CustomerReportComponent,
    SellReturnReportComponent,
    BalanceComponent,
    AccountBook1Component,
 



  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    MatCheckboxModule,
    BrowserAnimationsModule,
    NgbModule,
        MatTabsModule,
    MatProgressSpinnerModule,
    MatCardModule,

    NgxDatatableModule,
    MatTableModule,
        ToastrModule.forRoot({
      timeOut: 3000,
      positionClass: 'toast-top-right',
      preventDuplicates: true,
    }),

    MatDialogModule,
    MatDatepickerModule,
    MatFormFieldModule,
        MatExpansionModule,

    MatInputModule,
    MatSelectModule,
    MatButtonModule,
        HttpClientModule,   // <- include here

    MatNativeDateModule,
    FormsModule,
    ReactiveFormsModule,
    ReactiveFormsModule,
    FormsModule,
    MatIconModule,
    RouterModule ,
    MatAutocompleteModule,
    MatMenuModule,
    MatDividerModule,
    MatButtonModule,
    CommonModule,// ✅ Fix router-outlet issue
        NgxDaterangepickerMd.forRoot()

  ],
  providers: [
    provideClientHydration(),
    DatePipe,

    // ✅ Corrected Firebase Initialization
    provideFirebaseApp(() => initializeApp(environment.firebaseConfig)),
    provideFirestore(() => getFirestore()),
        AngularFirestoreModule,

  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
