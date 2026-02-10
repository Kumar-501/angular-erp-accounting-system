import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { PurchaseRequisitionService } from '../services/purchase-requisition.service';
import { LocationService } from '../services/location.service';

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
  supplier?: string | boolean;
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
  businessLocations: any[] = [];

  constructor(
    private route: ActivatedRoute,
    private requisitionService: PurchaseRequisitionService,
    private locationService: LocationService
  ) {}

  ngOnInit(): void {
    // First load the business locations
    this.locationService.getLocations().subscribe({
      next: (locations) => {
        this.businessLocations = locations;
        
        // Then load the requisition data
        const id = this.route.snapshot.paramMap.get('id');
        if (id) {
          this.requisitionService.getRequisitionById(id).subscribe({
            next: (data) => {
              // Find the matching location name
              const locationObj = this.businessLocations.find(loc => loc.id === data.location);
              const locationName = locationObj ? locationObj.name : data.location;
              
              this.requisition = {
                ...data,
                locationName: locationName,
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
      },
      error: (error) => {
        console.error('Error loading locations:', error);
        this.isLoading = false;
      }
    });
  }

  goBack() {
    window.history.back();
  }

  printRequisition() {
    window.print();
  }

  // Updated to calculate grand total with tax (purchasePriceIncTax * requiredQuantity)
  getGrandTotal(): number {
    if (!this.requisition || !this.requisition.items) return 0;
    return this.requisition.items.reduce((total, item) => {
      return total + (item.requiredQuantity * (item.purchasePriceIncTax || 0));
    }, 0);
  }

  // Helper method to get total for individual item with tax
  getItemTotal(item: RequisitionItem): number {
    return item.requiredQuantity * (item.purchasePriceIncTax || 0);
  }
}