import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-analytics-dashboard',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="hp-page">
      <h1>Analytics</h1>
      <div class="hp-card">
        <div class="hp-empty-state">
          <mat-icon class="hp-empty-icon">analytics</mat-icon>
          <h3>Analytics</h3>
          <p>Phase 2+ — Coming Soon</p>
          <p>Dashboards, A/B comparisons, and operational reporting.</p>
        </div>
      </div>
    </div>
  `,
})
export class AnalyticsDashboardComponent {}
