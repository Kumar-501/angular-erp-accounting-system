import { Component, OnInit, OnDestroy } from '@angular/core';
import { LeadService } from '../services/leads.service';
import { UserService } from '../services/user.service';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { AuthService } from '../auth.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-leads-report',
  templateUrl: './leads-reports.component.html',
  styleUrls: ['./leads-reports.component.scss']
})
export class LeadsReportsComponent implements OnInit, OnDestroy {
  allLeads: any[] = [];
  filteredLeads: any[] = [];
  departmentReports: any[] = [];
  executiveReports: any[] = [];
  
  reportType: string = 'department';
  currentPage: number = 1;
  pageSize: number = 10;
  totalPages: number = 1;
  
  filters = {
    fromDate: '',
    toDate: ''
  };

  private leadsSubscription: Subscription | null = null;

  constructor(
    private leadService: LeadService,
    private userService: UserService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadLeads();
  }

  ngOnDestroy(): void {
    if (this.leadsSubscription) {
      this.leadsSubscription.unsubscribe();
    }
  }

  loadLeads() {
    // Unsubscribe from previous subscription if exists
    if (this.leadsSubscription) {
      this.leadsSubscription.unsubscribe();
    }

    const currentUserRole = this.authService.currentUserValue?.role || '';
    const currentUserDepartment = this.authService.currentUserValue?.department || '';
    const currentUserName = this.authService.getCurrentUserName();
    
    // Use the existing getLeads method with proper parameters
    this.leadsSubscription = this.leadService.getLeads(currentUserRole, currentUserName).subscribe({
      next: (leads: any[]) => {
        let filtered = leads;
        
        // Apply additional role-based filtering if needed
        if (currentUserRole === 'Supervisor') {
          filtered = leads.filter((lead: { department: string; }) => lead.department === currentUserDepartment);
        }
        // Executive filtering is already handled in the service
        
        this.allLeads = filtered;
        this.applyFilters();
      },
      error: (error: any) => {
        console.error('Error loading leads:', error);
        this.allLeads = [];
        this.applyFilters();
      }
    });
  }

  applyFilters() {
    let filtered = [...this.allLeads];
    
    // Apply date filter
    if (this.filters.fromDate || this.filters.toDate) {
      filtered = filtered.filter(lead => {
        const leadDate = lead.createdAt ? new Date(lead.createdAt) : null;
        if (!leadDate) return false;
        
        if (this.filters.fromDate && this.filters.toDate) {
          const fromDate = new Date(this.filters.fromDate);
          const toDate = new Date(this.filters.toDate);
          toDate.setHours(23, 59, 59, 999);
          return leadDate >= fromDate && leadDate <= toDate;
        } else if (this.filters.fromDate) {
          const fromDate = new Date(this.filters.fromDate);
          return leadDate >= fromDate;
        } else if (this.filters.toDate) {
          const toDate = new Date(this.filters.toDate);
          toDate.setHours(23, 59, 59, 999);
          return leadDate <= toDate;
        }
        return true;
      });
    }
    
    this.filteredLeads = filtered;
    this.generateReports();
  }

  generateReports() {
    this.generateDepartmentReport();
    this.generateExecutiveReport();
    this.updatePagination();
  }

  generateDepartmentReport() {
    const departmentMap = new Map<string, any>();
    
    this.filteredLeads.forEach(lead => {
      const dept = lead.department || 'Unassigned';
      
      if (!departmentMap.has(dept)) {
        departmentMap.set(dept, {
          department: dept,
          total: 0,
          new: 0,
          contacted: 0,
          qualified: 0,
          converted: 0,
          lost: 0
        });
      }
      
      const deptData = departmentMap.get(dept);
      deptData.total++;
      
      switch (lead.lifeStage) {
        case 'New':
          deptData.new++;
          break;
        case 'Contacted':
          deptData.contacted++;
          break;
        case 'Qualified':
          deptData.qualified++;
          break;
        case 'Converted':
          deptData.converted++;
          break;
        case 'Lost':
          deptData.lost++;
          break;
      }
    });
    
    // Convert map to array and calculate conversion rates
    this.departmentReports = Array.from(departmentMap.values()).map(dept => ({
      ...dept,
      conversionRate: dept.total > 0 ? Math.round((dept.converted / dept.total) * 100) : 0
    }));
  }

  generateExecutiveReport() {
    const executiveMap = new Map<string, any>();
    
    this.filteredLeads.forEach(lead => {
      const exec = lead.assignedTo || 'Unassigned';
      const key = `${exec}|${lead.department || 'Unassigned'}`;
      
      if (!executiveMap.has(key)) {
        executiveMap.set(key, {
          executive: exec,
          department: lead.department || 'Unassigned',
          total: 0,
          new: 0,
          contacted: 0,
          qualified: 0,
          converted: 0,
          lost: 0
        });
      }
      
      const execData = executiveMap.get(key);
      execData.total++;
      
      switch (lead.lifeStage) {
        case 'New':
          execData.new++;
          break;
        case 'Contacted':
          execData.contacted++;
          break;
        case 'Qualified':
          execData.qualified++;
          break;
        case 'Converted':
          execData.converted++;
          break;
        case 'Lost':
          execData.lost++;
          break;
      }
    });
    
    // Convert map to array and calculate conversion rates
    this.executiveReports = Array.from(executiveMap.values()).map(exec => ({
      ...exec,
      conversionRate: exec.total > 0 ? Math.round((exec.converted / exec.total) * 100) : 0
    }));
  }

  getTotal(field: string): number {
    if (this.reportType === 'department') {
      return this.departmentReports.reduce((sum, dept) => sum + dept[field], 0);
    } else {
      return this.executiveReports.reduce((sum, exec) => sum + exec[field], 0);
    }
  }

  getTotalConversionRate(): number {
    const totalConverted = this.getTotal('converted');
    const totalLeads = this.getTotal('total');
    return totalLeads > 0 ? Math.round((totalConverted / totalLeads) * 100) : 0;
  }

  changeReportType() {
    this.currentPage = 1;
    this.updatePagination();
  }

  updatePagination() {
    if (this.reportType === 'detailed') {
      this.totalPages = Math.ceil(this.filteredLeads.length / this.pageSize);
    }
  }

  onPageSizeChange() {
    this.currentPage = 1;
    this.updatePagination();
  }

  previousPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }
  }

  clearDateFilter() {
    this.filters.fromDate = '';
    this.filters.toDate = '';
    this.applyFilters();
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'New': return 'status-new';
      case 'Contacted': return 'status-contacted';
      case 'Qualified': return 'status-qualified';
      case 'Converted': return 'status-converted';
      case 'Lost': return 'status-lost';
      default: return '';
    }
  }

  exportExcel() {
    let data: any[] = [];
    const fileName = `leads_report_${new Date().toISOString().slice(0,10)}.xlsx`;
    
    if (this.reportType === 'department') {
      data = this.departmentReports.map(dept => ({
        Department: dept.department,
        'Total Leads': dept.total,
        'New Leads': dept.new,
        Contacted: dept.contacted,
        Qualified: dept.qualified,
        Converted: dept.converted,
        Lost: dept.lost,
        'Conversion Rate': `${dept.conversionRate}%`
      }));
    } else if (this.reportType === 'executive') {
      data = this.executiveReports.map(exec => ({
        Executive: exec.executive,
        Department: exec.department,
        'Total Leads': exec.total,
        'New Leads': exec.new,
        Contacted: exec.contacted,
        Qualified: exec.qualified,
        Converted: exec.converted,
        Lost: exec.lost,
        'Conversion Rate': `${exec.conversionRate}%`
      }));
    } else {
      // Detailed report
      const startIdx = (this.currentPage - 1) * this.pageSize;
      const endIdx = startIdx + this.pageSize;
      const paginatedLeads = this.filteredLeads.slice(startIdx, endIdx);
      
      data = paginatedLeads.map(lead => ({
        'Contact ID': lead.contactId || '-',
        Name: lead.businessName || `${lead.firstName || ''} ${lead.lastName || ''}`.trim(),
        Mobile: lead.mobile || '-',
        Department: lead.department || 'Unassigned',
        Executive: lead.assignedTo || 'Unassigned',
        'Life Stage': lead.lifeStage || '-',
        Source: lead.source || '-',
        'Created Date': lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : '-',
        'Last Follow Up': lead.lastFollowUp ? new Date(lead.lastFollowUp).toLocaleDateString() : '-',
        Status: lead.lifeStage || '-'
      }));
    }
    
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Leads Report');
    XLSX.writeFile(workbook, fileName);
  }

  exportPDF() {
    const doc = new jsPDF();
    const title = `Leads Report (${this.reportType}) - ${new Date().toLocaleDateString()}`;
    
    doc.setFontSize(16);
    doc.text(title, 14, 15);
    
    let data: any[] = [];
    let headers: string[] = [];
    
    if (this.reportType === 'department') {
      headers = ['Department', 'Total', 'New', 'Contacted', 'Qualified', 'Converted', 'Lost', 'Conversion Rate'];
      data = this.departmentReports.map(dept => [
        dept.department,
        dept.total.toString(),
        dept.new.toString(),
        dept.contacted.toString(),
        dept.qualified.toString(),
        dept.converted.toString(),
        dept.lost.toString(),
        `${dept.conversionRate}%`
      ]);
    } else if (this.reportType === 'executive') {
      headers = ['Executive', 'Department', 'Total', 'New', 'Contacted', 'Qualified', 'Converted', 'Lost', 'Conversion Rate'];
      data = this.executiveReports.map(exec => [
        exec.executive,
        exec.department,
        exec.total.toString(),
        exec.new.toString(),
        exec.contacted.toString(),
        exec.qualified.toString(),
        exec.converted.toString(),
        exec.lost.toString(),
        `${exec.conversionRate}%`
      ]);
    } else {
      // Detailed report
      headers = ['Contact ID', 'Name', 'Mobile', 'Department', 'Executive', 'Life Stage', 'Source', 'Created Date', 'Status'];
      const startIdx = (this.currentPage - 1) * this.pageSize;
      const endIdx = startIdx + this.pageSize;
      const paginatedLeads = this.filteredLeads.slice(startIdx, endIdx);
      
      data = paginatedLeads.map(lead => [
        lead.contactId || '-',
        lead.businessName || `${lead.firstName || ''} ${lead.lastName || ''}`.trim(),
        lead.mobile || '-',
        lead.department || 'Unassigned',
        lead.assignedTo || 'Unassigned',
        lead.lifeStage || '-',
        lead.source || '-',
        lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : '-',
        lead.lifeStage || '-'
      ]);
    }
    
    (doc as any).autoTable({
      head: [headers],
      body: data,
      startY: 20,
      styles: {
        fontSize: 8,
        cellPadding: 2,
        overflow: 'linebreak'
      },
      margin: { top: 20 }
    });
    
    doc.save(`leads_report_${this.reportType}_${new Date().toISOString().slice(0,10)}.pdf`);
  }
}