import { Component, OnInit, HostListener } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DraftService } from '../services/draft.service';
import { Firestore, doc, updateDoc, deleteDoc, addDoc, collection } from '@angular/fire/firestore';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { CustomerService } from '../services/customer.service';
import { ProductsService } from '../services/products.service';

import 'jspdf-autotable';
import { saveAs } from 'file-saver';
import { Router } from '@angular/router';

@Component({
  selector: 'app-list-draft',
  templateUrl: './list-draft.component.html',
  styleUrls: ['./list-draft.component.scss']
})
export class ListDraftComponent implements OnInit {
  drafts: any[] = [];
  displayedDrafts: any[] = [];
  customersMap: {[key: string]: any} = {};
  sortColumn: string = 'saleDate';
  sortDirection: 'asc' | 'desc' = 'desc';
  sortedDrafts: any[] = [];

  productsMap: {[key: string]: any} = {};
  
  // Pagination
  entriesPerPage: number = 25;
  currentPage: number = 1;
  totalEntries: number = 0;
  startEntry: number = 0;
  endEntry: number = 0;
  totalPages: number = 0;
  searchQuery: string = '';

  // Forms
  showAddForm = false;
  showEditForm = false;
  currentDraftId: string | null = null;
  addForm: FormGroup;
  editForm: FormGroup;

  // Column visibility
  showColumnVisibility = false;
  columnVisibility = {
    sno: true,
    customer: true,
    saleDate: true,
    discountAmount: true,
    totalPayable: true,
    productName: true,  // New property for product name
    quantity: true,     // New property for quantity
    action: true
  };

  @HostListener('document:keydown.escape', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    if (this.showAddForm) {
      this.closeAddForm();
    }
    if (this.showEditForm) {
      this.closeEditForm();
    }
    if (this.showColumnVisibility) {
      this.showColumnVisibility = false;
    }
  }

  @HostListener('document:click', ['$event'])
  clickOutside(event: MouseEvent) {
    const columnVisibilityButton = document.querySelector('.btn-columns');
    const columnVisibilityDropdown = document.querySelector('.column-visibility-dropdown');
    
    if (this.showColumnVisibility && 
        columnVisibilityButton && 
        columnVisibilityDropdown && 
        !columnVisibilityButton.contains(event.target as Node) && 
        !columnVisibilityDropdown.contains(event.target as Node)) {
      this.showColumnVisibility = false;
    }
  }

  constructor(
    private draftService: DraftService,
    private fb: FormBuilder,
    private customerService: CustomerService,
    private productsService: ProductsService,
    private firestore: Firestore,
    private router: Router
  ) {
    this.addForm = this.fb.group({
      customer: ['', Validators.required],
      saleDate: ['', Validators.required],
      discountAmount: [0, [Validators.required, Validators.min(0)]],
      shippingCharges: [0, [Validators.required, Validators.min(0)]],
      shippingStatus: ['pending', Validators.required]
    });

    this.editForm = this.fb.group({
      customer: ['', Validators.required],
      saleDate: ['', Validators.required],
      discountAmount: [0, [Validators.required, Validators.min(0)]],
      shippingCharges: [0, [Validators.required, Validators.min(0)]],
      shippingStatus: ['pending', Validators.required]
    });
  }

  ngOnInit(): void {
    this.loadDrafts();
    this.loadCustomers();
    this.loadProducts();
  }

  loadDrafts(): void {
    this.draftService.getDraftsRealTime((drafts) => {
      this.drafts = drafts;
      this.updatePagination();
    });
  }

  loadProducts(): void {
    this.productsService.getProductsRealTime().subscribe({
      next: (products: any[]) => {
        products.forEach(product => {
          this.productsMap[product.id] = product;
        });
      },
      error: (error) => {
        console.error('Error loading products:', error);
      }
    });
  }

  getCustomerName(customerId: string): string {
    const customer = this.customersMap[customerId];
    if (customer) {
      return customer.businessName || 
        (customer.firstName + ' ' + (customer.middleName ? customer.middleName + ' ' : '') + customer.lastName);
    }
    return customerId; // Fallback to ID if customer not found
  }

  // Add a method to get product info
  getProductInfo(draft: any): { name: string, quantity: number } {
    if (draft.products && draft.products.length > 0) {
      const firstProduct = draft.products[0];
      return {
        name: firstProduct.productName || 'N/A',
        quantity: firstProduct.quantity || 0
      };
    }
    return { name: 'N/A', quantity: 0 };
  }

  loadCustomers(): void {
    this.customerService.getCustomers().subscribe({
      next: (customers: any[]) => {
        // Create a map of customer ID to customer details
        customers.forEach(customer => {
          this.customersMap[customer.id] = customer;
        });
      },
      error: (error) => {
        console.error('Error loading customers:', error);
      }
    });
  }

  calculateTotalPayable(draft: any): number {
    return draft.totalPayable || (draft.discountAmount - (draft.discountAmount * 0.1) + draft.shippingCharges);
  }

  // Pagination methods
  updatePagination(): void {
    this.totalEntries = this.drafts.length;
    this.totalPages = Math.ceil(this.totalEntries / this.entriesPerPage);
    this.applyPagination();
  }

  applyPagination(): void {
    const startIndex = (this.currentPage - 1) * this.entriesPerPage;
    const endIndex = Math.min(startIndex + this.entriesPerPage, this.totalEntries);

    this.displayedDrafts = this.drafts.slice(startIndex, endIndex);
    this.startEntry = this.totalEntries > 0 ? startIndex + 1 : 0;
    this.endEntry = endIndex;
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.applyPagination();
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.applyPagination();
    }
  }

  // Sorting
  sortBy(column: string): void {
    this.drafts.sort((a, b) => {
      if (a[column] < b[column]) return -1;
      if (a[column] > b[column]) return 1;
      return 0;
    });
    this.applyPagination();
  }

  // Search
  applySearch(): void {
    if (!this.searchQuery) {
      this.loadDrafts();
      return;
    }

    const query = this.searchQuery.toLowerCase();
    this.drafts = this.drafts.filter(draft => {
      // Also search in product name
      const productInfo = this.getProductInfo(draft);
      return draft.customer.toLowerCase().includes(query) ||
             draft.discountAmount.toString().includes(query) ||
             productInfo.name.toLowerCase().includes(query) ||
             productInfo.quantity.toString().includes(query);
    });

    this.currentPage = 1;
    this.updatePagination();
  }

  // Add Form methods
  openAddForm(): void {
    this.showAddForm = true;
    this.addForm.reset({
      discountAmount: 0,
      shippingCharges: 0,
      shippingStatus: 'pending'
    });
  }

  closeAddForm(): void {
    this.showAddForm = false;
  }

  submitDraft(): void {
    if (this.addForm.valid) {
      const draftData = this.addForm.value;
      draftData.saleDate = new Date(draftData.saleDate).toISOString();
      
      const draftsCollection = collection(this.firestore, 'drafts');
      addDoc(draftsCollection, draftData)
        .then(() => {
          this.closeAddForm();
        })
        .catch(error => {
          console.error('Error adding draft:', error);
        });
    }
  }

  // Edit Form methods
  editDraft(draft: any): void {
    this.currentDraftId = draft.id;
    this.editForm.patchValue({
      customer: draft.customer,
      saleDate: this.formatDateForInput(draft.saleDate),
      discountAmount: draft.discountAmount,
      shippingCharges: draft.shippingCharges,
      shippingStatus: draft.shippingStatus
    });
    this.showEditForm = true;
  }

  private formatDateForInput(dateString: string): string {
    const date = new Date(dateString);
    return date.toISOString().slice(0, 16);
  }

  saveDraft(): void {
    if (this.editForm.valid && this.currentDraftId) {
      const draftData = this.editForm.value;
      draftData.saleDate = new Date(draftData.saleDate).toISOString();
      
      const draftRef = doc(this.firestore, `drafts/${this.currentDraftId}`);
      updateDoc(draftRef, draftData)
        .then(() => {
          this.closeEditForm();
        })
        .catch(error => {
          console.error('Error updating draft:', error);
        });
    }
  }

  closeEditForm(): void {
    this.showEditForm = false;
    this.currentDraftId = null;
    this.editForm.reset();
  }

  // Delete method
  deleteDraft(id: string): void {
    if (confirm('Are you sure you want to delete this draft?')) {
      const draftRef = doc(this.firestore, `drafts/${id}`);
      deleteDoc(draftRef)
        .then(() => {
          console.log('Draft deleted successfully');
        })
        .catch(error => {
          console.error('Error deleting draft:', error);
        });
    }
  }

  // Add to Quotation method
  addToQuotation(draft: any): void {
    // Store draft data in local storage to be accessed by the quotation component
    const draftForQuotation = {
      customerId: draft.customer,
      customerName: this.getCustomerName(draft.customer),
      saleDate: draft.saleDate,
      discountAmount: draft.discountAmount,
      shippingCharges: draft.shippingCharges || 0,
      shippingStatus: draft.shippingStatus || 'pending',
      products: draft.products || []
    };
    
    localStorage.setItem('draftForQuotation', JSON.stringify(draftForQuotation));
    this.router.navigate(['/add-quotation']);
  }

  // Column visibility methods
  toggleColumnVisibility(): void {
    this.showColumnVisibility = !this.showColumnVisibility;
  }

  toggleColumn(column: string): void {
    this.columnVisibility[column as keyof typeof this.columnVisibility] = 
      !this.columnVisibility[column as keyof typeof this.columnVisibility];
  }
  
  // Export methods
  exportCSV(): void {
    const headers = ['#', 'Customer', 'Sale Date', 'Discount Amount', 'Total Payable', 'Product Name', 'Quantity'];
    const rows = this.drafts.map((draft, index) => {
      const productInfo = this.getProductInfo(draft);
      return [
        index + 1,
        this.getCustomerName(draft.customer),
        new Date(draft.saleDate).toLocaleString(),
        draft.discountAmount,
        this.calculateTotalPayable(draft),
        productInfo.name,
        productInfo.quantity
      ];
    });

    const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    saveAs(blob, 'drafts.csv');
  }

  exportExcel(): void {
    const data = this.drafts.map(draft => {
      const productInfo = this.getProductInfo(draft);
      return {
        '#': this.drafts.indexOf(draft) + 1,
        'Customer': this.getCustomerName(draft.customer),
        'Sale Date': new Date(draft.saleDate).toLocaleString(),
        'Discount Amount': draft.discountAmount,
        'Total Payable': this.calculateTotalPayable(draft),
        'Product Name': productInfo.name,
        'Quantity': productInfo.quantity
      };
    });
    
    const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(data);
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Drafts');
    XLSX.writeFile(wb, 'drafts.xlsx');
  }
  
  exportPDF(): void {
    const doc = new jsPDF();
    const data = this.drafts.map(draft => {
      const productInfo = this.getProductInfo(draft);
      return [
        this.drafts.indexOf(draft) + 1,
        this.getCustomerName(draft.customer),
        new Date(draft.saleDate).toLocaleDateString(),
        '$' + draft.discountAmount.toFixed(2),
        '$' + this.calculateTotalPayable(draft).toFixed(2),
        productInfo.name,
        productInfo.quantity
      ];
    });
    
    (doc as any).autoTable({
      head: [['#', 'Customer', 'Sale Date', 'Discount Amount', 'Total Payable', 'Product Name', 'Quantity']],
      body: data,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255 }
    });
  
    doc.save('drafts.pdf');
  }
  
  printTable(): void {
    const printContent = document.getElementById('drafts-table');
    if (printContent) {
      const printWindow = window.open('', '', 'width=800,height=600');
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Drafts Report</title>
              <style>
                body { font-family: Arial, sans-serif; }
                table { width: 100%; border-collapse: collapse; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #2980b9; color: white; }
                tr:nth-child(even) { background-color: #f2f2f2; }
                .no-data { text-align: center; padding: 20px; }
              </style>
            </head>
            <body>
              <h2>Drafts Report</h2>
              ${printContent.outerHTML}
              <p>Generated on: ${new Date().toLocaleString()}</p>
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
        }, 500);
      }
    }
  }

  navigateToAddDraft(): void {
    this.router.navigate(['/add-draft']);
  }
}