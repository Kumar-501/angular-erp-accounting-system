import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { LeadService } from '../services/leads.service';
import { Location } from '@angular/common';

@Component({
  selector: 'app-lead-view',
  templateUrl: './lead-view.component.html',
  styleUrls: ['./lead-view.component.scss']
})
export class LeadViewComponent implements OnInit {
  lead: any = null;
  loading = true;
  error = '';

  constructor(
    private route: ActivatedRoute,
    private leadService: LeadService,
    private location: Location
  ) {}

  ngOnInit(): void {
    const leadId = this.route.snapshot.paramMap.get('id');
    if (leadId) {
      this.loadLead(leadId);
    } else {
      this.error = 'No lead ID provided';
      this.loading = false;
    }
  }

  async loadLead(leadId: string) {
    try {
      this.lead = await this.leadService.getLeadById(leadId);
      this.loading = false;
    } catch (err) {
      console.error('Error loading lead:', err);
      this.error = 'Failed to load lead details';
      this.loading = false;
    }
  }

  goBack() {
    this.location.back();
  }

  getProductNames(products: any): string {
    if (!products) return 'None';
    if (typeof products === 'string') return products;
    if (Array.isArray(products)) {
      return products.map(p => p.productName || p.name || '').filter(Boolean).join(', ');
    }
    if (typeof products === 'object') {
      return products.productName || products.name || '';
    }
    return 'None';
  }
}