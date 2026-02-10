import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CustomerService, Customer } from '../services/customer.service';
import { SaleService } from '../services/sale.service';
import { DocumentService, CustomerDocument } from '../services/document.service';
import { AuthService } from '../auth.service';
import { Observable, Subject } from 'rxjs';
import { takeUntil, map, finalize } from 'rxjs/operators';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

// Define interfaces for clarity
interface LedgerEntry {
  date: string;
  ref: string;
  type: string;
  location: string;
  status: string;
  credit: number;
  debit: number;
  balance: number;
  method: string;
  others: string;
  saleId?: string;
  invoiceNo?: string;
  paymentId?: string;
}

interface AccountSummary {
  openingBalance: number;
  totalInvoice: number;
  totalPaid: number;
  advanceBalance: number;
  balanceDue: number;
}

interface CustomerSale {
  id: string;
  saleDate: Date;
  invoiceNo: string;
  orderNo: string;
  status: string;
  paymentStatus: string;
  shippingStatus: string;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  paymentMethod: string;
  transactionId?: string;
  location: string;
  products: any[];
}

interface CustomerWithDate extends Customer {
  createdAt: Date;
}

interface CustomerPayment {
  paidOn: Date;
  referenceNo: string;
  amount: number;
  paymentMethod: string;
  transactionDetails: string;
  paymentFor: string;
  paymentForType: string;
  saleId: string;
}

interface CustomerActivity {
  id?: string;
  date: Date;
  action: string;
  by: string;
  notes: string;
  type: 'contact' | 'sale' | 'payment' | 'return' | 'status_change' | 'document' | 'communication';
  referenceId?: string;
  customerId: string;
  createdAt: Date;
  details?: string; // Additional field for detailed change information
  showDetails?: boolean; // <-- CORRECTED: Added optional property
}

interface ActivityChangeLog {
  field: string;
  oldValue: any;
  newValue: any;
  timestamp: Date;
}

@Component({
  selector: 'app-view-contact',
  templateUrl: './view-contact.component.html',
  styleUrls: ['./view-contact.component.scss']
})
export class ViewContactComponent implements OnInit, OnDestroy {
  customer$: Observable<CustomerWithDate | undefined> | undefined;
  isLoading = true;
  
  activeTab: string = 'ledger';
  
  ledgerEntries: LedgerEntry[] = [];
  accountSummary: AccountSummary = {
    openingBalance: 0,
    totalInvoice: 0,
    totalPaid: 0,
    advanceBalance: 0,
    balanceDue: 0
  };
  
  customerSales: CustomerSale[] = [];
  customerPayments: CustomerPayment[] = [];
  customerDocuments: any[] = [];
  customerActivities: CustomerActivity[] = [];
  
  // Modal and form state for adding documents/notes
  isNoteModalOpen = false;
  isSubmittingNote = false; 
  noteForm: FormGroup;
  selectedFile: File | null = null;
  uploadProgress: number = 0;
  
  dateRange = {
    startDate: '2025-04-01',
    endDate: '2026-03-31'
  };
  
  private destroy$ = new Subject<void>();
  currentCustomer: CustomerWithDate | null = null;
  currentUserName: string = '';
  currentUserId: string = '';

  // Store original customer data for change tracking
  private originalCustomerData: CustomerWithDate | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private customerService: CustomerService,
    private saleService: SaleService,
    private documentService: DocumentService,
    private authService: AuthService,
    private fb: FormBuilder
  ) {
    this.noteForm = this.fb.group({
      heading: ['', Validators.required],
      description: [''],
      isPrivate: [false]
    });

    // Get current user information
    this.currentUserName = this.authService.getCurrentUserName();
    this.currentUserId = this.authService.getCurrentUserId();
  }

  ngOnInit(): void {
    const customerId = this.route.snapshot.paramMap.get('id');
    if (customerId) {
      this.loadCustomerData(customerId);
    } else {
      this.isLoading = false;
      console.error('Customer ID not found in route.');
      this.router.navigate(['/customers']);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
  
  // Helper function to reliably convert Firestore Timestamps (and other formats) to Date
  private convertTimestampToDate(timestamp: any): Date {
    if (!timestamp) return new Date();
    if (typeof timestamp.toDate === 'function') {
      return timestamp.toDate();
    }
    if (timestamp instanceof Date) {
      return timestamp;
    }
    const date = new Date(timestamp);
    if (!isNaN(date.getTime())) return date;
    
    console.warn('Could not convert value to a valid Date:', timestamp);
    return new Date();
  }

 

  private loadCustomerDocuments(customerId: string): void {
    this.documentService.getDocumentsByCustomerId(customerId)
      .pipe(takeUntil(this.destroy$))
      .subscribe(docs => {
        this.customerDocuments = docs.map(doc => {
          return {
            ...doc,
            createdAt: this.convertTimestampToDate(doc.createdAt),
            updatedAt: this.convertTimestampToDate(doc.updatedAt),
            checkedAt: doc.checkedAt ? this.convertTimestampToDate(doc.checkedAt) : undefined
          };
        });
      });
  }

// REPLACE your old loadCustomerData function with this new one
private loadCustomerData(customerId: string): void {
  this.customer$ = this.customerService.getCustomerById(customerId).pipe(
    map(customer => {
      if (!customer) return undefined;
      const customerWithDate = {
        ...customer,
        createdAt: this.convertTimestampToDate(customer.createdAt)
      } as CustomerWithDate;

      if (this.originalCustomerData === null) {
        this.originalCustomerData = JSON.parse(JSON.stringify(customerWithDate));
      }

      return customerWithDate;
    })
  );
  
  this.customer$.pipe(
    takeUntil(this.destroy$)
  ).subscribe(customer => {
    this.isLoading = false;
    if (customer) {
      this.currentCustomer = customer;
      // Load other data first
      this.loadCustomerSalesData(customerId);
      this.loadCustomerDocuments(customerId);

      // --- START OF FIX ---
      // Chain the activity loading to prevent race conditions.
      // This ensures we load existing activities BEFORE checking for sale activities.
      this.customerService.getCustomerActivities(customerId)
        .pipe(takeUntil(this.destroy$))
        .subscribe(activities => {
          this.customerActivities = activities.map(activity => ({
            ...activity,
            date: this.convertTimestampToDate(activity.date),
            createdAt: this.convertTimestampToDate(activity.createdAt)
          }));

          // Now that we have the full list of activities, we can safely process sales.
          this.loadSaleActivities(customerId);

        }, error => {
          console.error('Error loading customer activities:', error);
          this.customerActivities = [];
          // Still attempt to load sale activities even if the main log fails.
          this.loadSaleActivities(customerId);
        });
      // --- END OF FIX ---

    } else {
      console.error('Customer with this ID not found.');
      this.router.navigate(['/customers']);
    }
  });
}

  // NEW: Load sale-related activities for the customer
// ... (keep all existing code before this function)

// REPLACE your existing loadSaleActivities function with this corrected version
private loadSaleActivities(customerId: string): void {
  const processedSaleIds = new Set<string>(); // Use a Set to track processed sales

  // Listen for sales by customer ID
  this.saleService.getSalesByCustomerId(customerId)
    .pipe(takeUntil(this.destroy$))
    .subscribe(sales => {
      sales.forEach(sale => {
        if (!processedSaleIds.has(sale.id)) {
          this.processSaleActivity(sale, customerId);
          processedSaleIds.add(sale.id); // Mark this sale as processed
        }
      });
    });

  // Also listen for sales by phone number if available
  if (this.currentCustomer?.mobile) {
    this.saleService.getSalesByContactNumber(this.currentCustomer.mobile)
      .pipe(takeUntil(this.destroy$))
      .subscribe(salesByPhone => {
        salesByPhone.forEach(sale => {
          if (!processedSaleIds.has(sale.id)) {
            this.processSaleActivity(sale, customerId);
            processedSaleIds.add(sale.id); // Also mark this sale as processed
          }
        });
      });
  }
}

// ... (keep all existing code after this function)

  // NEW: Process sale data to create detailed activities
// ... (keep all existing code before this function)

// REPLACE your old processSaleActivity function with this one
private async processSaleActivity(sale: any, customerId: string): Promise<void> {
  // Check if an activity for this specific sale ID already exists.
  const activityExists = this.customerActivities.some(activity => activity.referenceId === sale.id);

  // Only create a new activity if it does NOT exist.
  if (!activityExists) {
    try {
      const activityNotes = this.generateSaleActivityNotes(sale);
      
      await this.addCustomerActivity({
        customerId: customerId,
        action: `Sale ${sale.status}`,
        by: sale.addedBy || sale.createdBy || 'System',
        notes: activityNotes,
        type: 'sale',
        referenceId: sale.id,
        details: this.generateSaleDetails(sale)
      });
    } catch (error) {
      console.error('Error processing sale activity:', error);
    }
  }
}
// ... (keep all existing code after this function)
// Add this new function inside the ViewContactComponent class


  formatActivityAction(action: string): string {
    // This function translates system codes into readable text
    if (!action) return 'Activity';
    switch (action) {
      case 'lang_vl.customer-lost-btncustomer_updated_status':
        return 'Status Updated';
      case 'lang_vl.customer_assigned':
        return 'Assigned';
      default:
        return action;
    }
  }
 formatActivityNote(activity: CustomerActivity): string {
    // This function formats the note based on the activity type
    if (!this.currentCustomer) return activity.notes; // Safety fallback

    // If the activity is about the contact (e.g., Edited, Created, Status Update)
    if (activity.type === 'contact') {
      const customerName = this.currentCustomer.businessName || `${this.currentCustomer.firstName || ''} ${this.currentCustomer.lastName || ''}`.trim();
      // We will use '\n' to create new lines
      return `Type: Contact\nName: ${customerName}\nContact Id: ${this.currentCustomer.contactId || 'N/A'}`;
    }

    // If the activity is a sale
    if (activity.type === 'sale') {
      try {
        // We use the reliable 'details' field to get sale info
        const saleDetails = JSON.parse(activity.details || '{}');
        const totalAmount = (saleDetails.totalAmount || 0);
        const totalAmountFormatted = `₹${totalAmount.toFixed(2)}`;
        return `Type: Sale\nInvoice No: ${saleDetails.invoiceNo || 'N/A'}\nAmount: ${totalAmountFormatted}`;
      } catch (e) {
        return activity.notes; // Fallback if details are not available
      }
    }

    // For any other type of activity, return the original note
    return activity.notes;
  }


// ... (keep all other existing code in this file)
  // NEW: Generate detailed sale activity notes
  private generateSaleActivityNotes(sale: any): string {
    const products = sale.products || [];
    
    // CORRECTED: Format numbers to 2 decimal places to avoid floating point issues.
    const productDetails = products.map((p: any) => 
      `${p.name || p.productName} (Qty: ${p.quantity}, Price: ₹${(p.unitPrice || 0).toFixed(2)})`
    ).join(', ');

    const totalAmountFormatted = (sale.totalAmount || sale.total || 0).toFixed(2);

    return `Invoice: ${sale.invoiceNo || 'N/A'}, Total: ₹${totalAmountFormatted}, Payment: ${sale.paymentMethod || 'N/A'}, Products: ${productDetails || 'None'}`;
  }

  // NEW: Generate detailed sale information
// ... (keep all existing code before this function)

// REPLACE your existing generateSaleDetails function with this corrected version
private generateSaleDetails(sale: any): string {
  return JSON.stringify({
    invoiceNo: sale.invoiceNo,
    orderNo: sale.orderNo,
    status: sale.status,
    paymentStatus: sale.paymentStatus,
    shippingStatus: sale.shippingStatus,
    // --- THIS IS THE FIX ---
    // Use a robust fallback to get the correct total amount
    totalAmount: sale.totalPayable || sale.totalAmount || sale.total || 0,
    // ----------------------
    paidAmount: sale.paidAmount || sale.paymentAmount,
    balanceAmount: sale.balanceAmount,
    paymentMethod: sale.paymentMethod,
    location: sale.location || sale.businessLocation,
    saleDate: sale.saleDate,
    productCount: sale.products?.length || 0
  }, null, 2);
}

// ... (keep all existing code after this function)

  // NEW: Track customer data changes and create detailed activities
  private async trackCustomerChanges(oldData: CustomerWithDate, newData: CustomerWithDate): Promise<void> {
    const changes: ActivityChangeLog[] = [];
    const fieldsToTrack = [
      'businessName', 'firstName', 'lastName', 'email', 'mobile', 'landline',
      'alternateContact', 'status', 'addressLine1', 'addressLine2', 'city',
      'state', 'country', 'zipCode', 'occupation', 'department', 'assignedTo'
    ];

    fieldsToTrack.forEach(field => {
      const oldValue = oldData[field as keyof CustomerWithDate];
      const newValue = newData[field as keyof CustomerWithDate];

      if (oldValue !== newValue) {
        changes.push({
          field: this.getFieldDisplayName(field),
          oldValue: oldValue || 'Empty',
          newValue: newValue || 'Empty',
          timestamp: new Date()
        });
      }
    });

    if (changes.length > 0) {
      const changeDetails = changes.map(change => 
        `${change.field}: "${change.oldValue}" → "${change.newValue}"`
      ).join(', ');

      await this.addCustomerActivity({
        customerId: newData.id!,
        action: 'Customer Data Updated',
        by: this.currentUserName || 'System',
        notes: `Updated fields: ${changeDetails}`,
        type: 'contact',
        details: JSON.stringify(changes, null, 2)
      });
    }
  }

  // NEW: Get user-friendly field names
  private getFieldDisplayName(field: string): string {
    const fieldMap: { [key: string]: string } = {
      'businessName': 'Business Name',
      'firstName': 'First Name',
      'lastName': 'Last Name',
      'email': 'Email',
      'mobile': 'Mobile',
      'landline': 'Landline',
      'alternateContact': 'Alternate Contact',
      'status': 'Status',
      'addressLine1': 'Address Line 1',
      'addressLine2': 'Address Line 2',
      'city': 'City',
      'state': 'State',
      'country': 'Country',
      'zipCode': 'Zip Code',
      'occupation': 'Occupation',
      'department': 'Department',
      'assignedTo': 'Assigned To'
    };
    
    return fieldMap[field] || field;
  }

  private loadCustomerSalesData(customerId: string): void {
    // Load sales by customer ID
    this.saleService.getSalesByCustomerId(customerId)
      .pipe(takeUntil(this.destroy$))
      .subscribe(sales => {
        this.customerSales = sales.map(sale => ({
          id: sale.id,
          saleDate: this.convertTimestampToDate(sale.saleDate),
          invoiceNo: sale.invoiceNo || 'N/A',
          orderNo: sale.orderNo || 'N/A',
          status: sale.status,
          paymentStatus: sale.paymentStatus || 'Due',
          shippingStatus: sale.shippingStatus || 'Pending',
          totalAmount: sale.totalPayable || sale.totalAmount || sale.total || sale.paymentAmount || 0,
          paidAmount: sale.paymentAmount || 0,
          balanceAmount: sale.balance || sale.balanceAmount || 0,
          paymentMethod: sale.paymentMethod || 'N/A',
          transactionId: sale.transactionId || '',
          location: sale.businessLocation || sale.location || 'N/A',
          products: sale.products || []
        }));
        
        this.updateLedgerAndSummary();
      });

    // Also load sales by contact number if available
    if (this.currentCustomer?.mobile) {
      this.saleService.getSalesByContactNumber(this.currentCustomer.mobile)
        .pipe(takeUntil(this.destroy$))
        .subscribe(salesByPhone => {
          if (salesByPhone.length > 0) {
            const phoneSales = salesByPhone.map(sale => ({
              id: sale.id,
              saleDate: this.convertTimestampToDate(sale.saleDate),
              invoiceNo: sale.invoiceNo || 'N/A',
              orderNo: sale.orderNo || 'N/A',
              status: sale.status,
              paymentStatus: sale.paymentStatus || 'Due',
              shippingStatus: sale.shippingStatus || 'Pending',
              totalAmount: sale.totalPayable || sale.totalAmount || sale.total || sale.paymentAmount || 0,
              paidAmount: sale.paymentAmount || 0,
              balanceAmount: sale.balance || sale.balanceAmount || 0,
              paymentMethod: sale.paymentMethod || 'N/A',
              transactionId: sale.transactionId || '',
              location: sale.businessLocation || sale.location || 'N/A',
              products: sale.products || []
            }));
            
            // Merge with existing sales, avoiding duplicates
            const existingIds = new Set(this.customerSales.map(s => s.id));
            const newSales = phoneSales.filter(s => !existingIds.has(s.id));
            
            if (newSales.length > 0) {
              this.customerSales = [...this.customerSales, ...newSales];
              this.updateLedgerAndSummary();
            }
          }
        });
    }
  }
  
  private updateLedgerAndSummary(): void {
    if (this.currentCustomer) {
      this.calculateAccountSummary();
      this.generateLedgerFromSales();
      this.generatePaymentsList();
    }
  }
  
  private generatePaymentsList(): void {
    const payments: CustomerPayment[] = this.customerSales
      .filter(sale => sale.paidAmount > 0)
      .map(sale => {
        const details = sale.transactionId ? `(Transaction No.: ${sale.transactionId})` : '';
        return {
          paidOn: sale.saleDate,
          referenceNo: sale.invoiceNo,
          amount: sale.paidAmount,
          paymentMethod: sale.paymentMethod,
          transactionDetails: details,
          paymentFor: sale.orderNo,
          paymentForType: 'Sales',
          saleId: sale.id,
        };
      });

    this.customerPayments = payments.sort((a, b) => b.paidOn.getTime() - a.paidOn.getTime());
  }

  private generateLedgerFromSales(): void {
    if (!this.currentCustomer) return;

    const entries: LedgerEntry[] = [];
    let runningBalance = this.currentCustomer.openingBalance || 0;

    entries.push({
      date: this.formatDate(new Date(this.dateRange.startDate)),
      ref: '',
      type: 'Opening Balance',
      location: 'System',
      status: '',
      credit: this.currentCustomer.openingBalance || 0,
      debit: 0,
      balance: runningBalance,
      method: '',
      others: 'Opening Balance as of ' + this.dateRange.startDate
    });

    const sortedSales = [...this.customerSales].sort((a, b) => 
      a.saleDate.getTime() - b.saleDate.getTime()
    );

    sortedSales.forEach(sale => {
      if (sale.totalAmount > 0) {
        runningBalance += sale.totalAmount;
        entries.push({
          date: this.formatDate(sale.saleDate),
          ref: sale.invoiceNo,
          type: 'Sales',
          location: sale.location,
          status: sale.paymentStatus,
          credit: 0,
          debit: sale.totalAmount,
          balance: runningBalance,
          method: '',
          others: `Invoice: ${sale.invoiceNo}`,
          saleId: sale.id,
          invoiceNo: sale.invoiceNo
        });
      }

      if (sale.paidAmount > 0) {
        runningBalance -= sale.paidAmount;
        entries.push({
          date: this.formatDate(sale.saleDate),
          ref: sale.invoiceNo,
          type: 'Payment',
          location: sale.location,
          status: 'Paid',
          credit: sale.paidAmount,
          debit: 0,
          balance: runningBalance,
          method: sale.paymentMethod,
          others: `Payment for Invoice: ${sale.invoiceNo}`,
          saleId: sale.id,
          invoiceNo: sale.invoiceNo
        });
      }
    });

    this.ledgerEntries = entries;
  }

  private calculateAccountSummary(): void {
    if (!this.currentCustomer) return;
    
    console.log('Customer Sales Data:', this.customerSales);
    
    const totalInvoiceAmount = this.customerSales.reduce((sum, sale) => {
      const amount = sale.totalAmount || 0;
      console.log(`Sale ${sale.invoiceNo}: ${amount}`);
      return sum + amount;
    }, 0);
    
    const totalPaidAmount = this.customerSales.reduce((sum, sale) => {
      return sum + (sale.paidAmount || 0);
    }, 0);
    
    const balanceDue = totalInvoiceAmount - totalPaidAmount + (this.currentCustomer.openingBalance || 0);

    this.accountSummary = {
      openingBalance: this.currentCustomer.openingBalance || 0,
      totalInvoice: totalInvoiceAmount,
      totalPaid: totalPaidAmount,
      advanceBalance: balanceDue < 0 ? Math.abs(balanceDue) : 0,
      balanceDue: balanceDue > 0 ? balanceDue : 0
    };
    
    console.log('Account Summary:', this.accountSummary);
  }

  // --- Document & Note Methods ---
  openNoteModal(): void {
    this.isNoteModalOpen = true;
    this.uploadProgress = 0;
  }

  closeNoteModal(): void {
    if (this.isSubmittingNote) return;
    this.isNoteModalOpen = false;
    this.noteForm.reset({ isPrivate: false });
    this.selectedFile = null;
    this.uploadProgress = 0;
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      
      const maxSize = 10 * 1024 * 1024; // 10MB in bytes
      if (file.size > maxSize) {
        alert('File size must be less than 10MB');
        input.value = '';
        return;
      }
      
      const allowedTypes = ['image/*', 'application/pdf', 'text/*', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      const fileType = file.type;
      const isAllowed = allowedTypes.some(type => {
        if (type.endsWith('*')) {
          return fileType.startsWith(type.slice(0, -1));
        }
        return fileType === type;
      });
      
      if (!isAllowed) {
        alert('File type not allowed. Please select an image, PDF, or document file.');
        input.value = '';
        return;
      }
      
      this.selectedFile = file;
      console.log('File selected:', file.name, 'Size:', file.size, 'Type:', file.type);
    } else {
      this.selectedFile = null;
    }
  }

  async onAddNoteSubmit(): Promise<void> {
    if (this.noteForm.invalid) {
      this.noteForm.markAllAsTouched();
      return;
    }
  
    const customer = this.currentCustomer;
    if (!customer || !customer.id) {
      console.error("Cannot add note, customer data is not available.");
      alert('Cannot add note, customer data is not available.');
      return;
    }

    const formData = this.noteForm.value;
    if (!formData.heading || formData.heading.trim() === '') {
      alert('Heading is required');
      return;
    }

    this.isSubmittingNote = true;
    
    try {
      console.log('Submitting document with data:', formData);
      console.log('Selected file:', this.selectedFile);
      
      await this.documentService.addDocument(
        customer.id,
        {
          heading: formData.heading.trim(),
          description: formData.description ? formData.description.trim() : '',
          isPrivate: formData.isPrivate || false
        },
        this.selectedFile || undefined
      );
      
      console.log('Document added successfully');
      
      // UPDATED: Add detailed activity for document addition
      await this.addCustomerActivity({
        customerId: customer.id,
        action: 'Document Added',
        by: this.currentUserName || 'System',
        notes: `Document "${formData.heading}" added. ${formData.description ? `Description: ${formData.description}. ` : ''}${this.selectedFile ? `File: ${this.selectedFile.name} (${this.formatFileSize(this.selectedFile.size)})` : 'No file attached'}. Privacy: ${formData.isPrivate ? 'Private' : 'Public'}`,
        type: 'document',
        details: JSON.stringify({
          heading: formData.heading,
          description: formData.description,
          fileName: this.selectedFile?.name,
          fileSize: this.selectedFile?.size,
          fileType: this.selectedFile?.type,
          isPrivate: formData.isPrivate,
          addedAt: new Date().toISOString()
        }, null, 2)
      });
      
      alert('Document added successfully!');
      this.closeNoteModal();
      
    } catch (error) {
      console.error('Error adding document:', error);
      alert('Error adding document. Please try again. Error: ' + (error as any).message);
    } finally {
      this.isSubmittingNote = false;
    }
  }
  
  async deleteDocument(doc: CustomerDocument): Promise<void> {
    if (confirm('Are you sure you want to delete this document?')) {
      try {
        await this.documentService.deleteDocument(doc);
        
        // UPDATED: Add detailed activity for document deletion
        if (this.currentCustomer?.id) {
          await this.addCustomerActivity({
            customerId: this.currentCustomer.id,
            action: 'Document Deleted',
            by: this.currentUserName || 'System',
            notes: `Document "${doc.heading}" deleted. ${doc.description ? `Description: ${doc.description}. ` : ''}${doc.fileName ? `File: ${doc.fileName} (${this.formatFileSize(doc.fileSize || 0)}) ` : ''}Privacy: ${doc.isPrivate ? 'Private' : 'Public'}`,
            type: 'document',
            details: JSON.stringify({
              heading: doc.heading,
              description: doc.description,
              fileName: doc.fileName,
              fileSize: doc.fileSize,
              fileType: doc.fileType,
              isPrivate: doc.isPrivate,
              deletedAt: new Date().toISOString()
            }, null, 2)
          });
        }
        
        console.log('Document deleted successfully');
      } catch (error) {
        console.error('Error deleting document:', error);
        alert('Error deleting document: ' + (error as any).message);
      }
    }
  }

  downloadDocument(doc: CustomerDocument): void {
    this.documentService.downloadFile(doc);
  }

  // UPDATED: Enhanced customer activity method with current user info
  private async addCustomerActivity(activityData: {
    customerId: string;
    action: string;
    by: string;
    notes: string;
    type: 'contact' | 'sale' | 'payment' | 'return' | 'status_change' | 'document' | 'communication';
    referenceId?: string;
    details?: string;
  }): Promise<void> {
    try {
      await this.customerService.addCustomerActivity({
        ...activityData,
        date: new Date(),
        createdAt: new Date(),
        by: this.currentUserName || activityData.by || 'System'
      });
    } catch (error) {
      console.error('Error adding customer activity:', error);
    }
  }

  // --- General Methods ---
  switchTab(tab: string): void {
    this.activeTab = tab;
  }

  getFullAddress(customer: Customer): string {
    const addressParts = [
      customer.addressLine1,
      customer.addressLine2,
      customer.city,
      customer.district,
      customer.state,
      customer.country,
      customer.zipCode
    ].filter(Boolean);
    
    return addressParts.length > 0 ? addressParts.join(', ') : 'N/A';
  }

  private formatDate(date: Date): string {
    return date.toLocaleDateString('en-GB', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  // UPDATED: Enhanced time formatting for activities
  formatDisplayDate(date: any): string {
    const dt = this.convertTimestampToDate(date);
    return dt.toLocaleDateString('en-GB', {
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric'
    });
  }

  // NEW: Format activity time with better precision
  formatActivityTime(date: any): string {
    const dt = this.convertTimestampToDate(date);
    const now = new Date();
    const timeDiff = now.getTime() - dt.getTime();
    
    // If less than 24 hours, show relative time
    if (timeDiff < 24 * 60 * 60 * 1000) {
      const hours = Math.floor(timeDiff / (60 * 60 * 1000));
      const minutes = Math.floor((timeDiff % (60 * 60 * 1000)) / (60 * 1000));
      
      if (hours === 0) {
        return minutes <= 1 ? 'Just now' : `${minutes} minutes ago`;
      } else {
        return `${hours} hour${hours > 1 ? 's' : ''} ago`;
      }
    }
    
    // Otherwise show full date and time
    return dt.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
  
  formatPaymentDate(date: any): string {
    const dt = this.convertTimestampToDate(date);
    const day = dt.getDate().toString().padStart(2, '0');
    const month = (dt.getMonth() + 1).toString().padStart(2, '0');
    const year = dt.getFullYear();
    const hours = dt.getHours().toString().padStart(2, '0');
    const minutes = dt.getMinutes().toString().padStart(2, '0');
    return `${day}-${month}-${year} ${hours}:${minutes}`;
  }

  deletePayment(payment: any): void {
    alert('Delete functionality for individual payments is not implemented.');
    console.log('Attempted to delete payment:', payment);
  }

  formatCurrency(amount: number = 0): string {
    return '₹ ' + amount.toFixed(2);
  }

  printLedger(): void { window.print(); }
  exportToExcel(): void { console.log('Export to Excel clicked'); }
  exportToPDF(): void { console.log('Export to PDF clicked'); }

  viewSaleDetails(saleId: string): void { 
    // UPDATED: Add activity for viewing sale details
    if (this.currentCustomer?.id) {
      this.addCustomerActivity({
        customerId: this.currentCustomer.id,
        action: 'Sale Details Viewed',
        by: this.currentUserName || 'System',
        notes: `Sale details viewed for sale ID: ${saleId}`,
        type: 'sale',
        referenceId: saleId
      });
    }
    this.router.navigate(['/sales/view', saleId]); 
  }

  editSale(saleId: string): void { 
    // UPDATED: Add activity for editing sale
    if (this.currentCustomer?.id) {
      this.addCustomerActivity({
        customerId: this.currentCustomer.id,
        action: 'Sale Edit Initiated',
        by: this.currentUserName || 'System',
        notes: `Sale edit initiated for sale ID: ${saleId}`,
        type: 'sale',
        referenceId: saleId
      });
    }
    this.router.navigate(['/sales-order/edit', saleId]); 
  }

  updateDateRange(): void {
    this.updateLedgerAndSummary();
  }

  getStatusBadgeClass(status: string): string {
    switch (status?.toLowerCase()) {
      case 'completed': case 'paid': return 'badge bg-success';
      case 'pending': case 'partial': return 'badge bg-warning';
      case 'cancelled': case 'unpaid': return 'badge bg-danger';
      default: return 'badge bg-secondary';
    }
  }

  getPaymentStatusBadgeClass(status: string): string {
    switch (status?.toLowerCase()) {
      case 'paid': return 'badge bg-success';
      case 'partial': return 'badge bg-warning';
      case 'due': case 'unpaid': return 'badge bg-danger';
      default: return 'badge bg-secondary';
    }
  }

  getShippingStatusBadgeClass(status: string): string {
    switch (status?.toLowerCase()) {
      case 'delivered': return 'badge bg-success';
      case 'shipped': case 'processing': return 'badge bg-info';
      case 'pending': return 'badge bg-warning';
      case 'cancelled': return 'badge bg-danger';
      default: return 'badge bg-secondary';
    }
  }

  getProductDetails(products: any[]): string {
    if (!products || products.length === 0) return 'No products';
    return products.length === 1
      ? `${products[0].name} (${products[0].quantity})`
      : `${products[0].name} (${products[0].quantity}) and ${products.length - 1} more`;
  }

  formatFileSize(bytes: number): string {
    return this.documentService.formatFileSize(bytes);
  }

  getFileIcon(fileType: string): string {
    return this.documentService.getFileIcon(fileType);
  }

  getActivityTypeBadgeClass(type: string): string {
    switch (type?.toLowerCase()) {
      case 'contact': return 'badge bg-primary';
      case 'sale': return 'badge bg-success';
      case 'payment': return 'badge bg-info';
      case 'return': return 'badge bg-warning';
      case 'status_change': return 'badge bg-secondary';
      case 'document': return 'badge bg-dark';
      case 'communication': return 'badge bg-light text-dark';
      default: return 'badge bg-secondary';
    }
  }

  formatActivityType(type: string): string {
    switch (type?.toLowerCase()) {
      case 'contact': return 'Contact';
      case 'sale': return 'Sale';
      case 'payment': return 'Payment';
      case 'return': return 'Return';
      case 'status_change': return 'Status Change';
      case 'document': return 'Document';
      case 'communication': return 'Communication';
      default: return type || 'Activity';
    }
  }

  // NEW: Get activity icon based on type
  getActivityIcon(type: string): string {
    switch (type?.toLowerCase()) {
      case 'contact': return 'fa-user';
      case 'sale': return 'fa-shopping-cart';
      case 'payment': return 'fa-credit-card';
      case 'return': return 'fa-undo';
      case 'status_change': return 'fa-exchange-alt';
      case 'document': return 'fa-file-alt';
      case 'communication': return 'fa-comments';
      default: return 'fa-info-circle';
    }
  }

  // NEW: Check if activity has detailed information
  hasActivityDetails(activity: CustomerActivity): boolean {
    return !!(activity.details || activity.referenceId);
  }

  // NEW: Toggle activity details display
  toggleActivityDetails(activity: CustomerActivity): void {
    // CORRECTED: Removed 'as any' cast
    activity.showDetails = !activity.showDetails;
  }

  // NEW: Format activity details for display
  formatActivityDetails(details: string | undefined): string {
    if (!details) return '';
    try {
      const parsed = JSON.parse(details);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return details;
    }
  }
}