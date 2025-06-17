import { Component, OnInit } from '@angular/core';
import { Firestore, collection, onSnapshot, doc, deleteDoc } from '@angular/fire/firestore';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

declare var $: any;

interface ShippingSummary {
  id?: string;
  invoiceNo: string;
  shippingStatus: string;
  date: string;
  dateObject?: Date | null;
}

@Component({
  selector: 'app-shipping-summary',
  templateUrl: './shipping-summary.component.html',
  styleUrls: ['./shipping-summary.component.scss']
})
export class ShippingSummaryComponent implements OnInit {
  shipments: ShippingSummary[] = [];
  filteredShipments: ShippingSummary[] = [];
  isLoading = true;
  isDeleting = false;
  searchTerm = '';
  currentPage = 1;
  entriesPerPage = 10;
  selectedShipment: ShippingSummary | null = null;
  startDate = '';
  endDate = '';
  dateFilterActive = false;
  Math = Math;

  constructor(private firestore: Firestore) {}

  ngOnInit(): void {
    this.loadShipments();
  }

  loadShipments(): void {
    const salesCollection = collection(this.firestore, 'sales');
    const unsubscribe = onSnapshot(salesCollection, (querySnapshot) => {
      this.shipments = querySnapshot.docs.map(doc => {
        const data = doc.data();
        const saleDate = data['saleDate'] ? new Date(data['saleDate']) : null;
        
        return {
          id: doc.id,
          invoiceNo: data['invoiceNo'] || 'N/A',
          shippingStatus: data['shippingStatus'] || 'Pending',
          date: saleDate ? this.formatDateForDisplay(saleDate) : 'N/A',
          dateObject: saleDate
        };
      });
           
      this.filteredShipments = [...this.shipments];
      this.isLoading = false;
    });
  }

  private formatDateForDisplay(date: Date): string {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  applyFilters(): void {
    let filtered = [...this.shipments];
    
    // Apply date filters first
    if (this.startDate || this.endDate) {
      const startDate = this.startDate ? new Date(this.startDate) : null;
      const endDate = this.endDate ? new Date(this.endDate) : null;

      if (startDate || endDate) {
        filtered = filtered.filter(shipment => {
          if (!shipment.dateObject) return false;
          
          const shipmentDate = new Date(shipment.dateObject);
          shipmentDate.setHours(0, 0, 0, 0); // Normalize time to midnight

          if (startDate && endDate) {
            startDate.setHours(0, 0, 0, 0);
            endDate.setHours(0, 0, 0, 0);
            return shipmentDate >= startDate && shipmentDate <= endDate;
          } else if (startDate) {
            startDate.setHours(0, 0, 0, 0);
            return shipmentDate >= startDate;
          } else if (endDate) {
            endDate.setHours(0, 0, 0, 0);
            return shipmentDate <= endDate;
          }
          return true;
        });
      }
      this.dateFilterActive = true;
    } else {
      this.dateFilterActive = false;
    }

    // Apply search filter
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(shipment => 
        shipment.invoiceNo.toLowerCase().includes(term) ||
        shipment.shippingStatus.toLowerCase().includes(term) ||
        shipment.date.toLowerCase().includes(term)
      );
    }
    
    this.filteredShipments = filtered;
    this.currentPage = 1;
  }

  clearDateFilter(): void {
    this.startDate = '';
    this.endDate = '';
    this.dateFilterActive = false;
    this.applyFilters();
  }

  deleteShipment(shipment: ShippingSummary): void {
    this.selectedShipment = shipment;
    $('#deleteModal').modal('show');
  }

  async confirmDelete(): Promise<void> {
    if (!this.selectedShipment || !this.selectedShipment.id) {
      return;
    }

    this.isDeleting = true;
    
    try {
      const docRef = doc(this.firestore, 'sales', this.selectedShipment.id);
      await deleteDoc(docRef);
      $('#deleteModal').modal('hide');
      this.showSuccessMessage(`Shipment ${this.selectedShipment.invoiceNo} deleted successfully!`);
    } catch (error) {
      console.error('Error deleting shipment:', error);
      this.showErrorMessage('Failed to delete shipment. Please try again.');
    } finally {
      this.isDeleting = false;
      this.selectedShipment = null;
    }
  }

  private showSuccessMessage(message: string): void {
    alert(message);
  }

  private showErrorMessage(message: string): void {
    alert(message);
  }

  exportToExcel(): void {
    const data = this.filteredShipments.map(shipment => ({
      'Invoice Number': shipment.invoiceNo,
      'Shipping Status': shipment.shippingStatus,
      'Date': shipment.date
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Shipping Summary');
    XLSX.writeFile(workbook, 'shipping_summary.xlsx');
  }

  exportToPDF(): void {
    const doc = new jsPDF();
    const columns = ['Invoice Number', 'Shipping Status', 'Date'];
    const rows = this.filteredShipments.map(shipment => [
      shipment.invoiceNo,
      shipment.shippingStatus,
      shipment.date
    ]);

    (doc as any).autoTable({
      head: [columns],
      body: rows,
      theme: 'grid',
      headStyles: {
        fillColor: [22, 160, 133]
      },
      margin: { top: 20 },
      didDrawPage: (data: any) => {
        doc.text('Shipping Summary Report', 14, 10);
      }
    });

    doc.save('shipping_summary.pdf');
  }

  getStatusBadgeClass(status: string): string {
    const statusMap: {[key: string]: string} = {
      'Processing': 'badge bg-info',
      'Packed': 'badge bg-primary',
      'Pending': 'badge bg-warning',
      'Shipped': 'badge bg-info',
      'Delivered': 'badge bg-success',
      'Cancelled': 'badge bg-danger'
    };

    return statusMap[status] || 'badge bg-secondary';
  }

  getTotalPages(): number {
    return Math.ceil(this.filteredShipments.length / this.entriesPerPage);
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  nextPage(): void {
    if (this.currentPage < this.getTotalPages()) {
      this.currentPage++;
    }
  }
}