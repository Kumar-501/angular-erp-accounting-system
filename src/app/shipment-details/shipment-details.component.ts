import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { SaleService } from '../services/sale.service';

// Interface for the items in a shipment
interface ShipmentItem {
  name: string;
  quantity: number;
  price: number;
}

// Interface for what we want to display in our component
interface ShipmentDetails {
  id: string;
  date: string;
  invoiceNo: string;
  customerName: string;
  contactNumber: string;
  location: string;
  deliveryPerson: string;
  shippingStatus: string;
  paymentStatus: string;
  items: ShipmentItem[];
}

// Interface that matches what the SaleService returns
// Interface that matches what the SaleService returns
interface SalesOrder {
  id: string;
  saleDate: Date;  // Changed from string to Date
  invoiceNo: string;
  customer: string;
  balance: number;
  paymentAmount: number;
  shippingStatus: string;
  // Optional properties that might not exist on the SalesOrder type
  contactNumber?: string;
  billingAddress?: string;
  deliveryPerson?: string;
  items?: ShipmentItem[];
}
@Component({
  selector: 'app-shipment-details',
  templateUrl: './shipment-details.component.html',
  styleUrls: ['./shipment-details.component.scss']
})
export class ShipmentDetailsComponent implements OnInit {
  shipment: ShipmentDetails | null = null;

  constructor(
    private route: ActivatedRoute,
    private saleService: SaleService
  ) {}

  ngOnInit(): void {
    const shipmentId = this.route.snapshot.paramMap.get('id');
    if (shipmentId) {
      this.saleService.getSaleById(shipmentId).subscribe((order: SalesOrder) => {
        const paymentStatus =
          order.balance === 0 && order.paymentAmount > 0
            ? 'Paid'
            : order.balance > 0 && order.paymentAmount > 0
            ? 'Partial'
            : 'Unpaid';

        this.shipment = {
          id: order.id,
    date: order.saleDate.toLocaleDateString(), // Format the Date to string
          invoiceNo: order.invoiceNo,
          customerName: order.customer,
          contactNumber: order.contactNumber || '',
          location: order.billingAddress || '',
          deliveryPerson: order.deliveryPerson || '',
          shippingStatus: order.shippingStatus,
          paymentStatus: paymentStatus,
          items: order.items || []
        };
      });
    }
  }

  printPage(): void {
    window.print();
  }
}