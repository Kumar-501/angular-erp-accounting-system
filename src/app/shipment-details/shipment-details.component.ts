import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { SaleService } from '../services/sale.service';
import { Location } from '@angular/common';

// --- UPDATED: Interface with clearer property name ---
interface Shipment {
  id: string;
  date: string;
  invoiceNo: string;
  customer: string;
  contactNumber: string;
  alternateContact: string;
  location: string;
  billingAddress: string;
  shippingAddress: string; // Renamed from shippingDetails
  shippingStatus: string;
  shippingCharge: number;
  addedBy: string;
  addedByDisplayName: string;
  paymentStatus: string;
  balance: number;
  orderNo: string;
  paymentMethod: string;
  totalPayable: number;
  paymentAmount: number;
  products: any[];
  typeOfService: string;
  typeOfServiceName: string;
  activities: any[];
  deliveryPerson: string;
  shippingNotes: string;
}

@Component({
  selector: 'app-shipment-details',
  templateUrl: './shipment-details.component.html',
  styleUrls: ['./shipment-details.component.scss']
})
export class ShipmentDetailsComponent implements OnInit {
  shipment: Shipment | null = null;
  isLoading = true;

  constructor(
    private route: ActivatedRoute,
    private saleService: SaleService,
    private location: Location
  ) {}

  ngOnInit(): void {
    const shipmentId = this.route.snapshot.paramMap.get('id');
    if (shipmentId) {
      this.loadShipmentDetails(shipmentId);
    }
  }

  loadShipmentDetails(shipmentId: string): void {
    this.isLoading = true;
    this.saleService.getSaleById(shipmentId).subscribe({
      next: (order: any) => {
        this.shipment = this.transformOrderToShipment(order);
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading shipment:', err);
        this.isLoading = false;
      }
    });
  }
  
  // --- UPDATED: Transformation logic now maps to shippingAddress ---
  private transformOrderToShipment(order: any): Shipment {
    return {
      id: order.id,
      date: order.saleDate ? new Date(order.saleDate).toLocaleDateString() : 'N/A',
      invoiceNo: order.invoiceNo || 'N/A',
      customer: order.customer || 'N/A',
      contactNumber: order.customerPhone || order.contactNumber || 'N/A',
      alternateContact: order.alternateContact || 'N/A',
      location: order.location || order.businessLocation || 'N/A',
      billingAddress: order.billingAddress || 'N/A',
      // This line is updated to be more robust and use the new property name
      shippingAddress: order.shippingAddress || order.shippingDetails || 'N/A',
      shippingStatus: order.shippingStatus || 'N/A',
      shippingCharge: order.shippingCharges || 0,
      addedBy: order.addedBy || 'System',
      addedByDisplayName: order.addedByDisplayName || order.addedBy || 'System',
      paymentStatus: this.getPaymentStatus(order),
      balance: order.balance || 0,
      orderNo: order.orderNo || 'N/A',
      paymentMethod: order.paymentMethod || 'N/A',
      totalPayable: order.totalPayable || (order.paymentAmount + (order.balance || 0)),
      paymentAmount: order.paymentAmount || 0,
      products: order.products || [],
      typeOfService: order.typeOfService || 'Standard',
      typeOfServiceName: order.typeOfServiceName || order.typeOfService || 'Standard',
      activities: order.activities || [],
      deliveryPerson: order.deliveryPerson || 'N/A',
      shippingNotes: order.shippingNotes || 'N/A'
    };
  }

  private getPaymentStatus(order: any): string {
    if (order.balance === 0 && order.paymentAmount > 0) return 'Paid';
    if (order.balance > 0 && order.paymentAmount > 0) return 'Partial';
    return 'Unpaid';
  }

  getStatusBadgeClass(status: string): string {
    if (!status) return 'badge bg-secondary';
    
    const statusMap: {[key: string]: string} = {
      'Processing': 'badge bg-info',
      'Packed': 'badge bg-primary',
      'Pending': 'badge bg-warning',
      'Shipped': 'badge bg-info',
      'Delivered': 'badge bg-success',
      'Onhold': 'badge bg-secondary',
      'Ordered': 'badge bg-primary',
      'Print': 'badge bg-dark',
      'Reached hub': 'badge bg-info text-dark',
      'Out for delivery': 'badge bg-primary text-white',
      'Returned': 'badge bg-danger',
      'Cancelled': 'badge bg-danger text-white'
    };

    return statusMap[status] || 'badge bg-secondary';
  }

  printPage(): void {
    window.print();
  }

  goBack(): void {
    this.location.back();
  }

  getProductsSubtotal(): number {
    if (!this.shipment || !this.shipment.products) return 0;
    return this.shipment.products.reduce((sum, product) => {
      const quantity = product.quantity || 1;
      const price = product.price || product.unitPrice || 0;
      return sum + (quantity * price);
    }, 0);
  }
}