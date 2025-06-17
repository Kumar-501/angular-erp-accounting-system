import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { PurchaseRequisitionService } from '../services/purchase-requisition.service';

interface RequisitionItem {
  productId: string;
  productName: string;
  sku?: string;
  requiredQuantity: number;
  alertQuantity: number;
  currentStock?: number;
  unitPurchasePrice: number;
  purchasePriceIncTax: number;
}
interface Requisition {
  id: string;
  referenceNo: string;
  date: string;
  location: string;
  locationName: string;
  status: string;
  requiredByDate: string;
  addedBy: string;
  supplier?: string | boolean;  // Updated to accept both string and boolean
  supplierName?: string;
  items: RequisitionItem[];
}

@Component({
  selector: 'app-view-purchase-requisition',
  templateUrl: './view-purchase-requisition.component.html',
  styleUrls: ['./view-purchase-requisition.component.scss']
})
export class ViewPurchaseRequisitionComponent implements OnInit {
  requisition: Requisition | null = null;
  isLoading = true;

  constructor(
    private route: ActivatedRoute,
    private requisitionService: PurchaseRequisitionService
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.requisitionService.getRequisitionById(id).subscribe({
        next: (data) => {
          this.requisition = {
            ...data,
            items: data.items ? data.items.map(item => ({
              ...item,
              currentStock: item.currentStock || 0,
              alertQuantity: item.alertQuantity || 0,
              unitPurchasePrice: item.unitPurchasePrice || 0,
              purchasePriceIncTax: item.purchasePriceIncTax || 0
            })) : []
          };
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Error loading requisition:', error);
          this.isLoading = false;
        }
      });
    }
  }

  goBack() {
    window.history.back();
  }

  printRequisition() {
    window.print();
  }

  getGrandTotal(): number {
    if (!this.requisition || !this.requisition.items) return 0;
    return this.requisition.items.reduce((total, item) => {
      return total + (item.requiredQuantity * (item.unitPurchasePrice || 0));
    }, 0);
  }
}