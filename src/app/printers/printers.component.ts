// src/app/printers/printers.component.ts
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { PrinterService } from '../services/printers.service';

@Component({
  selector: 'app-printers',
  templateUrl: './printers.component.html',
  styleUrls: ['./printers.component.scss']
})
export class PrintersComponent implements OnInit {
  printers: any[] = [];

  constructor(private router: Router, private printerService: PrinterService) {}

  ngOnInit(): void {
    // Fetch printers data in real-time
    this.printerService.getPrintersRealTime().subscribe((printersList) => {
      this.printers = printersList;
    });
  }

  addPrinter() {
    // Navigate to the AddPrintersComponent page when the Add+ button is clicked
    this.router.navigate(['/add-printers']);
  }
}
