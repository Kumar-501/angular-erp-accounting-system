// crm-dashboard.component.ts
import { Component, OnInit } from '@angular/core';
import { LeadService } from '../../services/leads.service';
import { CustomerService } from '../../services/customer.service';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

@Component({
  selector: 'app-crm-dashboard',
  templateUrl: './crm-dashboard.component.html',
  styleUrls: ['./crm-dashboard.component.scss']
})
export class CrmDashboardComponent implements OnInit {
  // Main metrics
  totalLeads = 0;
  totalCustomers = 0;
  todaysLeads = 0;
  
  // Lead status metrics
  newLeads = 0;
  contactedLeads = 0;
  qualifiedLeads = 0;
  
  // Deal status metrics
  dealStatusCounts = {
    open: 0,
    closed: 0,
    lost: 0,
    won: 0
  };
  
  // Priority metrics
  priorityCounts = {
    new: 0,
    allotted: 0,
    lost: 0,
    urgent: 0
  };
  
  isLoading = true;
  hasError = false;
  
  constructor(
    private leadService: LeadService,
    private customerService: CustomerService
  ) {}

  ngOnInit(): void {
    this.loadDashboardData();
  }

  private loadDashboardData(): void {
    this.isLoading = true;
    this.hasError = false;
    
    // Load leads data
    this.leadService.getLeads()
      .pipe(
        map(leads => {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          // Filter out converted leads for active counts
          const activeLeads = leads.filter(lead => !lead.convertedAt);
          
          // Calculate metrics
          this.totalLeads = leads.length; // Total leads including converted
          this.todaysLeads = leads.filter(lead => {
            if (!lead.createdAt) return false;
            const leadDate = new Date(lead.createdAt);
            leadDate.setHours(0, 0, 0, 0);
            return leadDate.getTime() === today.getTime();
          }).length;
          
          // Lead status counts
          this.newLeads = activeLeads.filter(lead => lead.status === 'New').length;
          this.contactedLeads = activeLeads.filter(lead => lead.status === 'Contacted').length;
          this.qualifiedLeads = activeLeads.filter(lead => lead.status === 'Qualified').length;
          
          // Deal status counts
          this.dealStatusCounts = {
            open: activeLeads.filter(lead => lead.dealStatus === 'Open').length,
            closed: activeLeads.filter(lead => lead.dealStatus === 'Closed').length,
            lost: activeLeads.filter(lead => lead.dealStatus === 'Lost').length,
            won: activeLeads.filter(lead => lead.dealStatus === 'Won').length
          };
          
          // Priority counts
          this.priorityCounts = {
            new: activeLeads.filter(lead => lead.priority === 'New').length,
            allotted: activeLeads.filter(lead => lead.priority === 'Allotted').length,
            lost: activeLeads.filter(lead => lead.priority === 'Lost').length,
            urgent: activeLeads.filter(lead => lead.priority === 'Urgent').length
          };
          
          return leads;
        }),
        catchError(err => {
          console.error('Error loading leads:', err);
          this.hasError = true;
          return of([]);
        })
      )
      .subscribe(() => {
        this.checkIfLoadingComplete();
      });

    // Load customers count
    this.customerService.getCustomers()
      .pipe(
        catchError(err => {
          console.error('Error loading customers:', err);
          this.hasError = true;
          return of([]);
        })
      )
      .subscribe(customers => {
        this.totalCustomers = customers.length;
        this.checkIfLoadingComplete();
      });
  }

  private checkIfLoadingComplete(): void {
    if (this.totalLeads >= 0 && this.totalCustomers >= 0) {
      this.isLoading = false;
    }
  }

  refreshData(): void {
    this.loadDashboardData();
  }
}