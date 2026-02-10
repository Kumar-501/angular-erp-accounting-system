import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core'; // Added ViewChild, ElementRef
import { LeadService } from '../services/leads.service';
import { UserService } from '../services/user.service';
import { DepartmentService } from '../services/department.service';
import { SourceService } from '../services/source.service';
import * as XLSX from 'xlsx';
import { AuthService } from '../auth.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-leads-report',
  templateUrl: './leads-reports.component.html',
  styleUrls: ['./leads-reports.component.scss']
})
export class LeadsReportsComponent implements OnInit, OnDestroy {
  // Date Picker References
  @ViewChild('fromDatePicker') fromDatePicker!: ElementRef;
  @ViewChild('toDatePicker') toDatePicker!: ElementRef;

  // Data Holders
  allLeads: any[] = [];
  filteredLeads: any[] = [];
  paginatedLeads: any[] = []; 

  departmentReports: any[] = [];
  executiveReports: any[] = [];
  
  overallMetrics = {
    total: 0,
    converted: 0,
    conversionRate: 0,
    new: 0,
    lost: 0
  };

  departments: string[] = [];
  sources: any[] = [];

  reportType: string = 'department'; 
  currentPage: number = 1;
  pageSize: number = 10;
  totalPages: number = 1;

  sortColumn: string = 'createdAt';
  sortDirection: 'asc' | 'desc' = 'desc';
  
  // Internal filter values kept in YYYY-MM-DD
  filters = {
    fromDate: '',
    toDate: '',
    searchTerm: '',
    department: '',
    source: ''
  };

  private leadsSubscription: Subscription | null = null;

  constructor(
    private leadService: LeadService,
    private userService: UserService,
    private authService: AuthService,
    private departmentService: DepartmentService,
    private sourceService: SourceService
  ) {}

  ngOnInit(): void {
    this.loadLeads();
    this.loadDepartments();
    this.loadSources();
  }

  ngOnDestroy(): void {
    if (this.leadsSubscription) {
      this.leadsSubscription.unsubscribe();
    }
  }

  // --- NEW DATE HELPERS ---
  getFormattedDate(dateString: string): string {
    if (!dateString) return '';
    const parts = dateString.split('-');
    if (parts.length !== 3) return dateString;
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }

  openDatePicker(type: 'from' | 'to'): void {
    if (type === 'from') {
      this.fromDatePicker.nativeElement.showPicker();
    } else {
      this.toDatePicker.nativeElement.showPicker();
    }
  }

  onDateInput(event: any, type: 'from' | 'to'): void {
    const input = event.target.value.trim();
    const datePattern = /^(\d{2})-(\d{2})-(\d{4})$/;
    const match = input.match(datePattern);
    
    if (match) {
      const internalDate = `${match[3]}-${match[2]}-${match[1]}`;
      if (type === 'from') this.filters.fromDate = internalDate;
      else this.filters.toDate = internalDate;
      this.applyFilters();
    } else if (input === '') {
      if (type === 'from') this.filters.fromDate = '';
      else this.filters.toDate = '';
      this.applyFilters();
    }
  }

  // --- EXISTING LOGIC PRESERVED ---
  loadDepartments() {
    this.departmentService.getDepartments().subscribe(depts => {
      this.departments = depts.map(d => d.name || d.department);
    });
  }

  loadSources() {
    this.sourceService.getSources().then(sources => {
      this.sources = sources;
    });
  }

  loadLeads() {
    if (this.leadsSubscription) this.leadsSubscription.unsubscribe();

    const currentUserRole = this.authService.currentUserValue?.role || '';
    const currentUserDepartment = this.authService.currentUserValue?.department || '';
    const currentUserId = this.authService.getCurrentUserId();
    
    this.leadsSubscription = this.leadService.getLeads(currentUserRole, currentUserId, currentUserDepartment).subscribe({
      next: (leads: any[]) => {
        let leadsData = leads;
        if (currentUserRole === 'Supervisor') {
          leadsData = leads.filter(lead => lead.department === currentUserDepartment);
        }
        this.allLeads = leadsData;
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
    
    if (this.filters.fromDate || this.filters.toDate) {
      filtered = filtered.filter(lead => {
        const leadDate = lead.createdAt ? new Date(lead.createdAt) : null;
        if (!leadDate) return false;
        leadDate.setHours(0,0,0,0);

        const start = this.filters.fromDate ? new Date(this.filters.fromDate) : null;
        if (start) start.setHours(0,0,0,0);
        const end = this.filters.toDate ? new Date(this.filters.toDate) : null;
        if (end) end.setHours(23, 59, 59, 999);

        if (start && end) return leadDate >= start && leadDate <= end;
        if (start) return leadDate >= start;
        if (end) return leadDate <= end;
        return true;
      });
    }

    if (this.filters.department) filtered = filtered.filter(lead => lead.department === this.filters.department);
    if (this.filters.source) filtered = filtered.filter(lead => lead.source === this.filters.source);

    if (this.filters.searchTerm) {
      const term = this.filters.searchTerm.toLowerCase();
      filtered = filtered.filter(lead => 
        (lead.businessName || '').toLowerCase().includes(term) ||
        (lead.firstName || '').toLowerCase().includes(term) ||
        (lead.lastName || '').toLowerCase().includes(term) ||
        (lead.mobile || '').includes(term) ||
        (lead.contactId || '').toLowerCase().includes(term)
      );
    }
    
    this.filteredLeads = filtered;
    this.calculateOverallMetrics();
    this.generateReports();
    this.onSort(this.sortColumn, false); 
  }

  calculateOverallMetrics() {
    const total = this.filteredLeads.length;
    const converted = this.filteredLeads.filter(l => l.lifeStage === 'Converted' || l.status === 'Converted' || l.isConverted).length;
    const lost = this.filteredLeads.filter(l => l.dealStatus === 'Lost' || l.status === 'Lost').length;
    const newLeads = this.filteredLeads.filter(l => l.lifeStage === 'New' || l.status === 'New').length;

    this.overallMetrics = {
      total, converted, lost, new: newLeads,
      conversionRate: total > 0 ? Math.round((converted / total) * 100) : 0
    };
  }

  generateReports() {
    this.generateDepartmentReport();
    this.generateExecutiveReport();
  }

  onSort(column: string, toggleDirection: boolean = true) {
    if (toggleDirection) {
      if (this.sortColumn === column) {
        this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        this.sortColumn = column;
        this.sortDirection = 'asc';
      }
    }

    this.filteredLeads.sort((a, b) => {
      let valueA = this.getSortValue(a, column);
      let valueB = this.getSortValue(b, column);
      if (valueA < valueB) return this.sortDirection === 'asc' ? -1 : 1;
      if (valueA > valueB) return this.sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    this.updatePagination();
  }

  getSortValue(item: any, column: string): any {
    switch(column) {
      case 'name': return (item.businessName || item.firstName || '').toLowerCase();
      case 'createdAt': return item.createdAt ? new Date(item.createdAt).getTime() : 0;
      default: return (item[column] || '').toString().toLowerCase();
    }
  }

  updatePagination() {
    this.totalPages = Math.ceil(this.filteredLeads.length / this.pageSize);
    if (this.currentPage > this.totalPages) this.currentPage = 1;
    const startIndex = (this.currentPage - 1) * this.pageSize;
    this.paginatedLeads = this.filteredLeads.slice(startIndex, startIndex + this.pageSize);
  }

  onPageSizeChange() { this.currentPage = 1; this.updatePagination(); }
  previousPage() { if (this.currentPage > 1) { this.currentPage--; this.updatePagination(); } }
  nextPage() { if (this.currentPage < this.totalPages) { this.currentPage++; this.updatePagination(); } }

  generateDepartmentReport() {
    const departmentMap = new Map<string, any>();
    this.filteredLeads.forEach(lead => {
      const dept = lead.department || 'Unassigned';
      if (!departmentMap.has(dept)) {
        departmentMap.set(dept, { department: dept, total: 0, new: 0, contacted: 0, qualified: 0, converted: 0, lost: 0 });
      }
      const deptData = departmentMap.get(dept);
      deptData.total++;
      this.incrementStats(deptData, lead);
    });
    this.departmentReports = Array.from(departmentMap.values()).map(dept => ({
      ...dept, conversionRate: dept.total > 0 ? Math.round((dept.converted / dept.total) * 100) : 0
    }));
  }

  generateExecutiveReport() {
    const executiveMap = new Map<string, any>();
    this.filteredLeads.forEach(lead => {
      const exec = lead.assignedTo || 'Unassigned';
      const key = `${exec}|${lead.department || 'Unassigned'}`;
      if (!executiveMap.has(key)) {
        executiveMap.set(key, { executive: exec, department: lead.department || 'Unassigned', total: 0, new: 0, contacted: 0, qualified: 0, converted: 0, lost: 0 });
      }
      const execData = executiveMap.get(key);
      execData.total++;
      this.incrementStats(execData, lead);
    });
    this.executiveReports = Array.from(executiveMap.values()).map(exec => ({
      ...exec, conversionRate: exec.total > 0 ? Math.round((exec.converted / exec.total) * 100) : 0
    }));
  }

  incrementStats(dataObj: any, lead: any) {
    const status = lead.lifeStage || lead.status;
    const dealStatus = lead.dealStatus;
    if (lead.isConverted || status === 'Converted' || status === 'Won') dataObj.converted++;
    else if (dealStatus === 'Lost' || status === 'Lost') dataObj.lost++;
    else if (status === 'New') dataObj.new++;
    else if (status === 'Contacted') dataObj.contacted++;
    else if (status === 'Qualified') dataObj.qualified++;
  }

  getTotal(field: string): number {
    return (this.reportType === 'department' ? this.departmentReports : this.executiveReports).reduce((sum, item) => sum + item[field], 0);
  }

  changeReportType() { this.currentPage = 1; this.updatePagination(); }
  clearDateFilter() {
    this.filters = { fromDate: '', toDate: '', searchTerm: '', department: '', source: '' };
    this.applyFilters();
  }

  getStatusClass(status: string): string {
    if (!status) return '';
    const s = status.toLowerCase();
    if (s.includes('new')) return 'status-new';
    if (s.includes('converted') || s.includes('won')) return 'status-converted';
    if (s.includes('lost')) return 'status-lost';
    if (s.includes('contact')) return 'status-contacted';
    return '';
  }

  exportExcel() {
    let data: any[] = [];
    const dateStr = new Date().toISOString().slice(0,10);
    const fileName = `leads_report_${this.reportType}_${dateStr}.xlsx`;
    if (this.reportType === 'department') data = this.departmentReports;
    else if (this.reportType === 'executive') data = this.executiveReports;
    else {
      data = this.filteredLeads.map(lead => ({
        'Contact ID': lead.contactId,
        'Name': lead.businessName || `${lead.firstName} ${lead.lastName}`,
        'Mobile': lead.mobile,
        'Department': lead.department,
        'Assigned To': lead.assignedTo,
        'Life Stage': lead.lifeStage,
        'Source': lead.source,
        'Created Date': lead.createdAt ? new Date(lead.createdAt).toLocaleDateString('en-GB') : '-',
      }));
    }
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');
    XLSX.writeFile(workbook, fileName);
  }
}