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
import { StockService } from '../services/stock.service';


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
    private stockSubscription: Subscription | undefined; // Add this for stock updates

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
    private stockService: StockService // Inject StockService
  ) { }

  ngOnInit(): void {
    this.authService.getCurrentUser().subscribe(user => {
      if (user) {
        this.userName = user.displayName || user.email.split('@')[0];
        this.userId = user.uid;
      }
    });

    this.salesSubscription = this.saleService.listenForSales().subscribe((salesData) => {
      const completedSales = salesData.filter(sale => sale.status === 'Completed');
      this.totalSalesAmount = completedSales.reduce((sum, sale) => 
        sum + (sale.paymentAmount ? Number(sale.paymentAmount) : 0), 0);
      this.updateSalesCard(this.totalSalesAmount);
    });

    this.usersSubscription = this.userService.getUsers().subscribe((users) => {
      this.totalUsersCount = users.length;
      this.updateUsersCard(this.totalUsersCount);
    });

    this.customersSubscription = this.customerService.getCustomers().subscribe((customers) => {
      this.totalCustomersCount = customers.length;
      this.updateCustomersCard(this.totalCustomersCount);
    });

    this.productsSubscription = this.productsService.getProductsRealTime().subscribe((products) => {
      this.totalProductsCount = products.length;
      this.updateProductsCard(this.totalProductsCount);
    });
    
    this.stockSubscription = this.stockService.stockUpdated$.subscribe(() => {
      this.loadCurrentStockData();
    });

    // *** FIX APPLIED HERE: Changed all dot notation to bracket notation ***
    this.purchasesSubscription = this.purchaseService.getPurchases().subscribe((purchases) => {
      this.totalPurchaseDue = purchases.reduce((totalDueSum, purchase) => {
        let productsTotal = 0;
        let totalTax = 0;
        
        const purchaseProducts = purchase['products'];
        if (purchaseProducts && Array.isArray(purchaseProducts)) {
            purchaseProducts.forEach(product => {
                const quantity = Number(product['quantity']) || 0;
                // Accessing with ['price'] as required by the error message
                const price = Number(product['unitCost']) || Number(product['price']) || 0; 
                const taxRate = Number(product['taxRate']) || 0;
                
                const lineTotal = quantity * price;
                productsTotal += lineTotal;
                totalTax += lineTotal * (taxRate / 100);
            });
        }
        
        const shippingCharges = Number(purchase['shippingCharges']) || 0;
        const accurateGrandTotal = productsTotal + totalTax + shippingCharges;
        const paymentAmount = Number(purchase['paymentAmount']) || 0;
        const dueForThisPurchase = Math.max(0, accurateGrandTotal - paymentAmount);

        return totalDueSum + dueForThisPurchase;
      }, 0); 
      
      this.updatePurchaseDueCard(this.totalPurchaseDue);
    });

    this.purchaseReturnsSubscription = this.purchaseReturnService.getPurchaseReturns().subscribe((returns) => {
      this.totalPurchaseReturn = returns.reduce((sum, returnItem) => 
        sum + (returnItem.grandTotal ? Number(returnItem.grandTotal) : 0), 0);
      this.updatePurchaseReturnCard(this.totalPurchaseReturn);
    });

    this.suppliersSubscription = this.supplierService.getSuppliers().subscribe((suppliers) => {
      this.totalSuppliersCount = suppliers.length;
      this.updateSuppliersCard(this.totalSuppliersCount);
    });
  }

  async loadCurrentStockData(): Promise<void> {
    try {
      const stockData = await this.stockService['getCurrentStockData']();
      this.totalStockCount = stockData.reduce((sum: any, item: { currentStock: any; }) => sum + (item.currentStock || 0), 0);
      this.updateStockCard(this.totalStockCount);
    } catch (error) {
      console.error('Error loading current stock data:', error);
    }
  }

  ngOnDestroy(): void {
    if (this.salesSubscription) this.salesSubscription.unsubscribe();
    if (this.usersSubscription) this.usersSubscription.unsubscribe();
    if (this.customersSubscription) this.customersSubscription.unsubscribe();
    if (this.productsSubscription) this.productsSubscription.unsubscribe();
    if (this.purchasesSubscription) this.purchasesSubscription.unsubscribe();
    if (this.purchaseReturnsSubscription) this.purchaseReturnsSubscription.unsubscribe();
    if (this.suppliersSubscription) this.suppliersSubscription.unsubscribe();
    if (this.stockSubscription) this.stockSubscription.unsubscribe();
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

  updateUsersCard(totalUsers: number): void {
    const usersCard = this.cards.find(card => card.title === 'Total Users');
    if (usersCard) {
      usersCard.value = totalUsers.toLocaleString('en-US');
    }
  }

  updateCustomersCard(totalCustomers: number): void {
    const customersCard = this.cards.find(card => card.title === 'Total Customers');
    if (customersCard) {
      customersCard.value = totalCustomers.toLocaleString('en-US');
    }
  }

  updateProductsCard(totalProducts: number): void {
    const productsCard = this.cards.find(card => card.title === 'Total Products');
    if (productsCard) {
      productsCard.value = totalProducts.toLocaleString('en-US');
    }
  }

  updateStockCard(totalStock: number): void {
    const stockCard = this.cards.find(card => card.title === 'Current Stock');
    if (stockCard) {
      stockCard.value = totalStock.toLocaleString('en-US');
    }
  }

  updatePurchaseDueCard(totalDue: number): void {
    const purchaseDueCard = this.cards.find(card => card.title === 'Purchase Due');
    if (purchaseDueCard) {
      purchaseDueCard.value = `₹${totalDue.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })}`;
    }
  }

  updatePurchaseReturnCard(totalReturn: number): void {
    const purchaseReturnCard = this.cards.find(card => card.title === 'Purchase Return');
    if (purchaseReturnCard) {
      purchaseReturnCard.value = `₹${totalReturn.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })}`;
    }
  }

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