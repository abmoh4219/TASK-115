import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="hp-page">
      <h1>Dashboard</h1>
      <div class="hp-card">
        <div class="hp-empty-state">
          <mat-icon class="hp-empty-icon">dashboard</mat-icon>
          <h3>Admin Dashboard</h3>
          <p>Phase 2 — Coming Soon</p>
          <p>Property overview, occupancy stats, recent activity, and quick actions.</p>
        </div>
      </div>
    </div>
  `,
})
export class AdminDashboardComponent {}
