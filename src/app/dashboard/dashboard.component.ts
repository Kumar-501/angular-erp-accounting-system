import { Component, OnInit, OnDestroy } from '@angular/core';
import { SaleService } from '../services/sale.service';
import { UserService } from '../services/user.service';
import { CustomerService } from '../services/customer.service';
import { ProductsService } from '../services/products.service';
import { PurchaseService } from '../services/purchase.service';
import { PurchaseReturnService } from '../services/purchase-return.service';
import { SupplierService } from '../services/supplier.service';
import { Subscription } from 'rxjs';
import { AuthService } from '../auth.service';

interface DashboardCard {
  title: string;
  value: string;
  icon: string;
  color: string;
  trend: number;
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit, OnDestroy {
  userName: string = '';
  userId: string = '';
  selectedLocation: string = 'Select location';

  cards: DashboardCard[] = [
    {
      title: 'Total Sales',
      value: '₹0.00',
      icon: 'credit-card',
      color: 'green',
      trend: 8
    },
    {
      title: 'Total Users',
      value: '0',
      icon: 'users',
      color: 'blue',
      trend: 12
    },
    {
      title: 'Total Customers',
      value: '0',
      icon: 'users',
      color: 'purple',
      trend: 5
    },
    {
      title: 'Total Products',
      value: '0',
      icon: 'package',
      color: 'orange',
      trend: 15
    },
    {
      title: 'Current Stock',
      value: '0',
      icon: 'layers',
      color: 'teal',
      trend: -3
    },
    {
      title: 'Purchase Due',
      value: '₹0.00',
      icon: 'credit-card',
      color: 'red',
      trend: 10
    },
    {
      title: 'Purchase Return',
      value: '₹0.00',
      icon: 'refresh-cw',
      color: 'indigo',
      trend: -5
    },
    {
      title: 'Total Suppliers',
      value: '0',
      icon: 'truck',
      color: 'pink',
      trend: 0
    }
  ];
  Math = Math;
  
  // For subscriptions
  private salesSubscription: Subscription | undefined;
  private usersSubscription: Subscription | undefined;
  private customersSubscription: Subscription | undefined;
  private productsSubscription: Subscription | undefined;
  private purchasesSubscription: Subscription | undefined;
  private purchaseReturnsSubscription: Subscription | undefined;
  private suppliersSubscription: Subscription | undefined;
  
  totalSalesAmount: number = 0;
  totalUsersCount: number = 0;
  totalCustomersCount: number = 0;
  totalProductsCount: number = 0;
  totalStockCount: number = 0;
  totalPurchaseDue: number = 0;
  totalPurchaseReturn: number = 0;
  totalSuppliersCount: number = 0;

  constructor(
    private saleService: SaleService,
    private userService: UserService,
    private customerService: CustomerService,
    private productsService: ProductsService,
    private purchaseService: PurchaseService,
    private purchaseReturnService: PurchaseReturnService,
    private supplierService: SupplierService,
    private authService: AuthService,
  ) { }

  ngOnInit(): void {
    // Get user information
    this.authService.getCurrentUser().subscribe(user => {
      if (user) {
        this.userName = user.displayName || user.email.split('@')[0];
        this.userId = user.uid;
      }
    });

    // Subscribe to sales data to get total payment amount
    this.salesSubscription = this.saleService.listenForSales().subscribe((salesData) => {
      // Calculate total sales amount from all completed sales
      const completedSales = salesData.filter(sale => sale.status === 'Completed');
      this.totalSalesAmount = completedSales.reduce((sum, sale) => 
        sum + (sale.paymentAmount ? Number(sale.paymentAmount) : 0), 0);
      
      // Update the Total Sales card with the calculated value
      this.updateSalesCard(this.totalSalesAmount);
    });

    // Subscribe to users data to get total user count
    this.usersSubscription = this.userService.getUsers().subscribe((users) => {
      // Set the total users count
      this.totalUsersCount = users.length;
      
      // Update the Total Users card with the count
      this.updateUsersCard(this.totalUsersCount);
    });

    // Subscribe to customers data to get total customers count
    this.customersSubscription = this.customerService.getCustomers().subscribe((customers) => {
      // Set the total customers count
      this.totalCustomersCount = customers.length;
      
      // Update the Total Customers card with the count
      this.updateCustomersCard(this.totalCustomersCount);
    });

    // Subscribe to products data to get total products count and total stock
    this.productsSubscription = this.productsService.getProductsRealTime().subscribe((products) => {
      // Set the total products count
      this.totalProductsCount = products.length;
      
      // Calculate total stock across all products
      this.totalStockCount = products.reduce((sum, product) => 
        sum + (product.currentStock ? Number(product.currentStock) : 0), 0);
      
      // Update the cards with the calculated values
      this.updateProductsCard(this.totalProductsCount);
      this.updateStockCard(this.totalStockCount);
    });

    // Subscribe to purchases data to get total purchase due amount
    this.purchasesSubscription = this.purchaseService.getPurchases().subscribe((purchases) => {
      // Calculate total purchase due amount
      this.totalPurchaseDue = purchases.reduce((sum, purchase) => 
        sum + (purchase.paymentDue ? Number(purchase.paymentDue) : 0), 0);
      
      // Update the Purchase Due card with the calculated value
      this.updatePurchaseDueCard(this.totalPurchaseDue);
    });

    // Subscribe to purchase returns data to get total purchase return amount
    this.purchaseReturnsSubscription = this.purchaseReturnService.getPurchaseReturns().subscribe((returns) => {
      // Calculate total purchase return amount
      this.totalPurchaseReturn = returns.reduce((sum, returnItem) => 
        sum + (returnItem.grandTotal ? Number(returnItem.grandTotal) : 0), 0);
      
      // Update the Purchase Return card with the calculated value
      this.updatePurchaseReturnCard(this.totalPurchaseReturn);
    });

    // Subscribe to suppliers data to get total suppliers count
    this.suppliersSubscription = this.supplierService.getSuppliers().subscribe((suppliers) => {
      // Set the total suppliers count
      this.totalSuppliersCount = suppliers.length;
      
      // Update the Total Suppliers card with the count
      this.updateSuppliersCard(this.totalSuppliersCount);
    });
  }

  ngOnDestroy(): void {
    // Clean up subscriptions to prevent memory leaks
    if (this.salesSubscription) {
      this.salesSubscription.unsubscribe();
    }
    if (this.usersSubscription) {
      this.usersSubscription.unsubscribe();
    }
    if (this.customersSubscription) {
      this.customersSubscription.unsubscribe();
    }
    if (this.productsSubscription) {
      this.productsSubscription.unsubscribe();
    }
    if (this.purchasesSubscription) {
      this.purchasesSubscription.unsubscribe();
    }
    if (this.purchaseReturnsSubscription) {
      this.purchaseReturnsSubscription.unsubscribe();
    }
    if (this.suppliersSubscription) {
      this.suppliersSubscription.unsubscribe();
    }
  }

  updateSalesCard(totalAmount: number): void {
    const salesCard = this.cards.find(card => card.title === 'Total Sales');
    if (salesCard) {
      salesCard.value = `₹${totalAmount.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })}`;
    }
  }
  // Method to update the users card with the total users count
  updateUsersCard(totalUsers: number): void {
    const usersCard = this.cards.find(card => card.title === 'Total Users');
    if (usersCard) {
      usersCard.value = totalUsers.toLocaleString('en-US');
    }
  }

  // Method to update the customers card with the total customers count
  updateCustomersCard(totalCustomers: number): void {
    const customersCard = this.cards.find(card => card.title === 'Total Customers');
    if (customersCard) {
      customersCard.value = totalCustomers.toLocaleString('en-US');
    }
  }

  // Method to update the products card with the total products count
  updateProductsCard(totalProducts: number): void {
    const productsCard = this.cards.find(card => card.title === 'Total Products');
    if (productsCard) {
      productsCard.value = totalProducts.toLocaleString('en-US');
    }
  }

  // Method to update the stock card with the total stock count
  updateStockCard(totalStock: number): void {
    const stockCard = this.cards.find(card => card.title === 'Current Stock');
    if (stockCard) {
      stockCard.value = totalStock.toLocaleString('en-US');
    }
  }

  // Method to update the purchase due card with the total purchase due amount
  updatePurchaseDueCard(totalDue: number): void {
    const purchaseDueCard = this.cards.find(card => card.title === 'Purchase Due');
    if (purchaseDueCard) {
      purchaseDueCard.value = `₹${totalDue.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })}`;
    }
  }

  // Method to update the purchase return card with the total purchase return amount
  updatePurchaseReturnCard(totalReturn: number): void {
    const purchaseReturnCard = this.cards.find(card => card.title === 'Purchase Return');
    if (purchaseReturnCard) {
      purchaseReturnCard.value = `₹${totalReturn.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })}`;
    }
  }

  // Method to update the suppliers card with the total suppliers count
  updateSuppliersCard(totalSuppliers: number): void {
    const suppliersCard = this.cards.find(card => card.title === 'Total Suppliers');
    if (suppliersCard) {
      suppliersCard.value = totalSuppliers.toLocaleString('en-US');
    }
  }

  getTrendClass(trend: number): string {
    return trend >= 0 ? 'positive-trend' : 'negative-trend';
  }

  getTrendIcon(trend: number): string {
    return trend >= 0 ? '↑' : '↓';
  }
}