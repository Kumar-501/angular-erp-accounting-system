import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { BarcodesService } from '../services/barcodes.service'; // Import the service

@Component({
  selector: 'app-barcodes',
  templateUrl: './barcodes.component.html',
  styleUrls: ['./barcodes.component.scss']
})
export class BarcodesComponent implements OnInit {

  barcodesList: any[] = []; // Array to store the list of barcodes
  searchText: string = '';   // Declare searchText property to hold the search query

  constructor(private router: Router, private barcodeService: BarcodesService) { }

  // ngOnInit to subscribe to barcode data
  ngOnInit(): void {
    // Subscribe to the real-time barcode data from the BarcodesService
    this.barcodeService.getBarcodes().subscribe((barcodes) => {
      this.barcodesList = barcodes; // Update the list with real-time data
    });
  }

  // Method to navigate to the AddBarcodeComponent
  onAddBarcode() {
    this.router.navigate(['/add-barcodes']);
  }

  // Method to handle Edit action (you can customize this)
  onEditBarcode(barcodeId: string) {
    // Redirect to edit page, passing the barcode ID
    this.router.navigate(['/edit-barcodes', barcodeId]);
  }

  // Method to handle Delete action (you can customize this)
  onDeleteBarcode(barcodeId: string) {
    if (confirm('Are you sure you want to delete this barcode setting?')) {
      this.barcodeService.deleteBarcode(barcodeId).then(() => {
        console.log('Barcode deleted successfully');
      }).catch((error: any) => {
        console.error('Error deleting barcode:', error); // Handle any errors that occur
      });
    }
  }

  // Method to search barcodes based on the searchText
  searchBarcodes() {
    // Add logic to filter barcodes based on the searchText
    console.log('Searching for barcodes with query:', this.searchText);
    // Example of filtering (you can customize the logic based on your needs)
    this.barcodesList = this.barcodesList.filter(barcode => barcode.name.includes(this.searchText));
  }
}
