import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CommissionService } from '../services/commission.service';
import { UserService } from '../services/user.service';

import { Subscription } from 'rxjs';

@Component({
  selector: 'app-sales-agents',
  templateUrl: './sales-agents.component.html',
  styleUrls: ['./sales-agents.component.scss'],
})
export class SalesAgentsComponent implements OnInit, OnDestroy {
  salesAgents: any[] = [];
  filteredAgents: any[] = [];
  users: any[] = []; // Store users from UserService
  businesses: any[] = []; // Store businesses from RegistrationService
  businessTypes: any[] = []; // Store business types from BusinessTypeService
  showModal: boolean = false;
  agentForm!: FormGroup;
  isEditMode: boolean = false;
  currentAgentId: string | null = null;

  // Pagination
  currentPage: number = 1;
  entriesPerPage: number = 4;
  totalEntries: number = 0;
  totalPages: number = 0;

  // Search
  searchTerm: string = '';

  // Sorting
  sortColumn: string = '';
  sortDirection: string = 'asc'; // 'asc' or 'desc'

  private unsubscribe: () => void = () => {};
  private userSubscription: Subscription = new Subscription();
  private businessSubscription: Subscription = new Subscription();
  private businessTypeSubscription: Subscription = new Subscription();

  constructor(
    private fb: FormBuilder, 
    private commissionService: CommissionService,
    private userService: UserService,
 
  ) {}

  ngOnInit(): void {
    this.agentForm = this.fb.group({
      userId: ['', Validators.required],
      commissionPercentage: ['', [Validators.required, Validators.min(0)]],
      businessId: [''],
      businessTypeId: ['']
    });

    // Load users from UserService
    this.userSubscription = this.userService.getUsers().subscribe(users => {
      this.users = users;
    });





    // Set up real-time listener for sales agents
    this.unsubscribe = this.commissionService.listenToSalesAgents((agents) => {
      this.salesAgents = agents.map(agent => {
        // Find the corresponding user
        const user = this.users.find(u => u.id === agent.userId);
        // Find the corresponding business and business type (if these IDs exist in the agent object)
        const business = this.businesses.find(b => b.id === agent.businessId);
        const businessType = this.businessTypes.find(t => t.id === agent.businessTypeId);
        
        return {
          ...agent,
          userName: user ? `${user.firstName} ${user.lastName}` : 'Unknown User',
          businessName: business ? business.businessName : '',
          businessTypeName: businessType ? businessType.name : ''
        };
      });
      this.filteredAgents = [...this.salesAgents];
      this.totalEntries = this.filteredAgents.length;
      this.updatePagination();
    });
  }

  ngOnDestroy(): void {
    this.unsubscribe();
    this.userSubscription.unsubscribe();
    this.businessSubscription.unsubscribe();
    this.businessTypeSubscription.unsubscribe();
  }

  sortTable(column: string) {
    if (this.sortColumn === column) {
      // Reverse the sort direction if clicking the same column
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      // Set new column and default to ascending
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }

    this.filteredAgents.sort((a, b) => {
      const valueA = a[column];
      const valueB = b[column];

      // Handle numeric sorting for commission percentage
      if (column === 'commissionPercentage') {
        return this.sortDirection === 'asc' 
          ? valueA - valueB 
          : valueB - valueA;
      }

      // Handle string sorting for all other columns
      return this.sortDirection === 'asc'
        ? String(valueA).localeCompare(String(valueB))
        : String(valueB).localeCompare(String(valueA));
    });

    // Reset to first page after sorting
    this.currentPage = 1;
  }

  openModal(isEdit: boolean = false, agent: any = null) {
    this.isEditMode = isEdit;
    this.showModal = true;
    if (isEdit && agent) {
      this.currentAgentId = agent.id;
      this.agentForm.patchValue({
        userId: agent.userId,
        commissionPercentage: agent.commissionPercentage,
        businessId: agent.businessId || '',
        businessTypeId: agent.businessTypeId || ''
      });
    } else {
      this.agentForm.reset();
      this.currentAgentId = null;
    }
  }

  closeModal() {
    this.showModal = false;
    this.agentForm.reset();
    this.isEditMode = false;
    this.currentAgentId = null;
  }

  async saveAgent() {
    if (this.agentForm.valid) {
      const formData = this.agentForm.value;
      
      // Find the selected user to get the name
      const selectedUser = this.users.find(u => u.id === formData.userId);
      // Find the selected business to get the name
      const selectedBusiness = this.businesses.find(b => b.id === formData.businessId);
      // Find the selected business type to get the name
      const selectedBusinessType = this.businessTypes.find(t => t.id === formData.businessTypeId);
      
      const agentData = {
        userId: formData.userId,
        userName: selectedUser ? `${selectedUser.firstName} ${selectedUser.lastName}` : '',
        commissionPercentage: formData.commissionPercentage,
        businessId: formData.businessId,
        businessName: selectedBusiness ? selectedBusiness.businessName : '',
        businessTypeId: formData.businessTypeId,
        businessTypeName: selectedBusinessType ? selectedBusinessType.name : ''
      };

      if (this.isEditMode && this.currentAgentId) {
        await this.commissionService.updateSalesAgent(this.currentAgentId, agentData);
      } else {
        await this.commissionService.addSalesAgent(agentData);
      }
      this.closeModal();
    }
  }

  async deleteAgent(id: string) {
    if (confirm('Are you sure you want to delete this agent?')) {
      await this.commissionService.deleteSalesAgent(id);
    }
  }

  onEntriesChange() {
    this.entriesPerPage = Number(this.entriesPerPage);
    this.currentPage = 1;
    this.updatePagination();
  }

  exportCSV() {
    this.commissionService.exportAgentsCSV(this.salesAgents);
  }

  exportExcel() {
    this.commissionService.exportAgentsExcel(this.salesAgents);
  }

  exportPDF() {
    this.commissionService.exportAgentsCSV(this.salesAgents);
  }

  printTable() {
    // Create a print stylesheet
    const printStyle = `
      @media print {
        .sidebar, .header, .footer, .no-print {
          display: none !important;
        }
        body, html {
          height: auto !important;
          overflow: visible !important;
        }
        .content {
          width: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        table {
          width: 100%;
          border-collapse: collapse;
        }
        th, td {
          border: 1px solid #000;
          padding: 8px;
          text-align: left;
        }
      }
    `;
  
    // Create a style element
    const styleElement = document.createElement('style');
    styleElement.innerHTML = printStyle;
  
    // Get the table HTML
    const tableElement = document.querySelector('table');
    const tableHtml = tableElement ? tableElement.outerHTML : 'No data available';
  
    // Open a new window for printing
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Sales Agents Report</title>
            ${styleElement.outerHTML}
          </head>
          <body>
            <h1>Sales Agents Report</h1>
            ${tableHtml}
            <script>
              setTimeout(function() {
                window.print();
                window.close();
              }, 100);
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  }

  onSearch(event: any) {
    this.searchTerm = event.target.value.toLowerCase().trim();
    
    if (!this.searchTerm) {
      this.filteredAgents = [...this.salesAgents];
    } else {
      this.filteredAgents = this.salesAgents.filter(agent => {
        return (
          agent.userName.toLowerCase().includes(this.searchTerm) ||
          agent.commissionPercentage.toString().includes(this.searchTerm) ||
          (agent.businessName && agent.businessName.toLowerCase().includes(this.searchTerm)) ||
          (agent.businessTypeName && agent.businessTypeName.toLowerCase().includes(this.searchTerm))
        );
      });
    }
    
    // Reset sorting when searching
    this.sortColumn = '';
    this.sortDirection = 'asc';
    
    this.totalEntries = this.filteredAgents.length;
    this.currentPage = 1;
    this.updatePagination();
  }

  updatePagination(): void {
    this.totalEntries = this.filteredAgents.length;
    this.totalPages = Math.ceil(this.totalEntries / this.entriesPerPage);
    
    if (this.currentPage > this.totalPages && this.totalPages > 0) {
      this.currentPage = this.totalPages;
    }
  }

  get paginatedAgents() {
    const start = (this.currentPage - 1) * this.entriesPerPage;
    const end = start + this.entriesPerPage;
    return this.filteredAgents.slice(start, end);
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }
  }

  previousPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }
}