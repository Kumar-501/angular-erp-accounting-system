import { Component } from '@angular/core';
import { BarcodesService } from '../services/barcodes.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-add-barcodes',
  templateUrl: './add-barcodes.component.html',
  styleUrls: ['./add-barcodes.component.scss']
})
export class AddBarcodesComponent {
  
  barcodeSettings = {
    stickerSheetName: '',
    stickerSheetDescription: '',
    feedType: 'continuous', // Default option
    additionalTopMargin: 0,
    additionalLeftMargin: 0,
    widthOfSticker: 0,
    heightOfSticker: 0,
    paperWidth: 0,
    paperHeight: 0,
    stickersInRow: 0,
    distanceBetweenRows: 0,
    distanceBetweenColumns: 0,
    noOfStickersPerSheet: 0,
    setAsDefault: false
  };

  constructor(private barcodeService: BarcodesService, private router: Router) { }

  // Method to save barcode settings to Firestore
  saveBarcodeSettings() {
    this.barcodeService.saveBarcodeSettings(this.barcodeSettings).then(() => {
      // Redirect to barcodes component after saving
      this.router.navigate(['/barcodes']);
    }).catch((error) => {
      console.error('Error saving barcode settings:', error);
    });
  }
}
