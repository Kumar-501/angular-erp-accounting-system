import { Component, OnInit, Input } from '@angular/core';
import { PrinterService } from '../services/printers.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-add-printers',
  templateUrl: './add-printers.component.html',
  styleUrls: ['./add-printers.component.scss']
})
export class AddPrintersComponent implements OnInit {
  @Input() printerId: string | null = null;

  printerName: string = '';
  connectionType: string = '';
  capabilityProfile: string = '';
  charactersPerLine: string = '';
  ipAddress: string = '';
  port: string = '9100';

  constructor(
    private printerService: PrinterService,
    private router: Router
  ) {}

  ngOnInit(): void {
    if (this.printerId) {
      // If we have a printerId, fetch the existing printer data to update
      this.printerService.getPrinterById(this.printerId).subscribe(printerData => {
        if (printerData) {
          this.printerName = printerData['printerName'] || '';
          this.connectionType = printerData['connectionType'] || '';
          this.capabilityProfile = printerData['capabilityProfile'] || '';
          this.charactersPerLine = printerData['charactersPerLine'] || '';
          this.ipAddress = printerData['ipAddress'] || '';
          this.port = printerData['port'] || '9100';
        }
      });
    }
  }

  savePrinter(): void {
    const printerData = {
      printerName: this.printerName,
      connectionType: this.connectionType,
      capabilityProfile: this.capabilityProfile,
      charactersPerLine: this.charactersPerLine,
      ipAddress: this.ipAddress,
      port: this.port,
    };

    if (this.printerId) {
      // If we have a printerId, update the printer
      this.printerService.updatePrinter(this.printerId, printerData)
        .then(() => {
          console.log('Printer updated successfully');
          this.router.navigate(['/printers']); // Navigate to printers list (or any page you want)
        })
        .catch((error: unknown) => {
          if (error instanceof Error) {
            console.error('Error updating printer:', error.message);
          } else {
            console.error('Unknown error updating printer:', error);
          }
        });
    } else {
      // If no printerId, add a new printer
      this.printerService.addPrinter(printerData)
        .then(() => {
          console.log('Printer added successfully');
          this.router.navigate(['/printers']); // Navigate to printers list (or any page you want)
        })
        .catch((error: unknown) => {
          if (error instanceof Error) {
            console.error('Error adding printer:', error.message);
          } else {
            console.error('Unknown error adding printer:', error);
          }
        });
    }
  }
}
