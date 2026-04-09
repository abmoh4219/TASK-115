import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { AnalyticsService, SummaryStats, BuildingOccupancy } from '../../core/services/analytics.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="dashboard-page">
      <h1 class="page-title">Dashboard</h1>

      <!-- Summary Cards -->
      <div class="stats-grid" *ngIf="stats">
        <div class="stat-card">
          <div class="stat-card__icon-wrap stat-card__icon-wrap--blue">
            <mat-icon>people</mat-icon>
          </div>
          <div class="stat-card__info">
            <span class="stat-card__value">{{ stats.activeResidents }}</span>
            <span class="stat-card__label">Active Residents</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-card__icon-wrap stat-card__icon-wrap--teal">
            <mat-icon>school</mat-icon>
          </div>
          <div class="stat-card__info">
            <span class="stat-card__value">{{ stats.enrollmentsThisMonth }}</span>
            <span class="stat-card__label">Enrollments This Month</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-card__icon-wrap stat-card__icon-wrap--amber">
            <mat-icon>pending_actions</mat-icon>
          </div>
          <div class="stat-card__info">
            <span class="stat-card__value">{{ stats.pendingReviews }}</span>
            <span class="stat-card__label">Pending Reviews</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-card__icon-wrap stat-card__icon-wrap--purple">
            <mat-icon>chat</mat-icon>
          </div>
          <div class="stat-card__info">
            <span class="stat-card__value">{{ stats.messagesThisWeek }}</span>
            <span class="stat-card__label">Messages This Week</span>
          </div>
        </div>
      </div>

      <!-- Occupancy -->
      <div class="occupancy-section" *ngIf="occupancy.length > 0">
        <h2 class="section-title">Building Occupancy</h2>
        <div class="occupancy-grid">
          <div class="occ-card" *ngFor="let b of occupancy">
            <div class="occ-card__header">
              <mat-icon class="occ-card__icon">business</mat-icon>
              <span class="occ-card__name">{{ b.buildingName }}</span>
            </div>
            <div class="occ-card__bar-wrap">
              <div class="occ-card__bar" [style.width.%]="b.rate"></div>
            </div>
            <div class="occ-card__footer">
              <span>{{ b.occupied }}/{{ b.totalRooms }} rooms</span>
              <span class="occ-card__pct">{{ b.rate }}%</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Loading -->
      <div class="loading-state" *ngIf="loading">
        <p>Loading dashboard data...</p>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .dashboard-page { padding: 1.75rem 2rem; max-width: 1200px; margin: 0 auto; }
    .page-title { font-size: 1.375rem; font-weight: 800; color: #111827; margin: 0 0 1.5rem; }

    .stats-grid {
      display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2rem;
    }
    @media (max-width: 900px) { .stats-grid { grid-template-columns: repeat(2, 1fr); } }

    .stat-card {
      background: #fff; border: 1px solid #e5e7eb; border-radius: 12px;
      padding: 1.25rem; display: flex; align-items: center; gap: 1rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    .stat-card__icon-wrap {
      width: 48px; height: 48px; border-radius: 12px;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .stat-card__icon-wrap mat-icon { color: #fff; font-size: 24px; width: 24px; height: 24px; }
    .stat-card__icon-wrap--blue { background: #1e3a5f; }
    .stat-card__icon-wrap--teal { background: #0d9488; }
    .stat-card__icon-wrap--amber { background: #f59e0b; }
    .stat-card__icon-wrap--purple { background: #7c3aed; }

    .stat-card__info { display: flex; flex-direction: column; }
    .stat-card__value { font-size: 1.5rem; font-weight: 800; color: #111827; line-height: 1; }
    .stat-card__label { font-size: 0.75rem; color: #6b7280; margin-top: 0.25rem; }

    .section-title { font-size: 1rem; font-weight: 700; color: #374151; margin: 0 0 1rem; }

    .occupancy-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; }
    .occ-card {
      background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 1rem 1.25rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    .occ-card__header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem; }
    .occ-card__icon { font-size: 1.125rem; width: 1.125rem; height: 1.125rem; color: #1e3a5f; }
    .occ-card__name { font-size: 0.875rem; font-weight: 700; color: #111827; }

    .occ-card__bar-wrap {
      height: 8px; background: #f3f4f6; border-radius: 4px; overflow: hidden; margin-bottom: 0.5rem;
    }
    .occ-card__bar {
      height: 100%; background: linear-gradient(90deg, #1e3a5f, #2dd4bf); border-radius: 4px;
      transition: width 300ms ease;
    }
    .occ-card__footer {
      display: flex; justify-content: space-between;
      font-size: 0.75rem; color: #6b7280;
    }
    .occ-card__pct { font-weight: 700; color: #1e3a5f; }

    .loading-state { text-align: center; padding: 3rem; color: #9ca3af; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminDashboardComponent implements OnInit {
  loading = true;
  stats: SummaryStats | null = null;
  occupancy: BuildingOccupancy[] = [];

  constructor(
    private analytics: AnalyticsService,
    private cdr: ChangeDetectorRef,
  ) {}

  async ngOnInit(): Promise<void> {
    this.loading = true;
    try {
      const [stats, occupancy] = await Promise.all([
        this.analytics.getSummaryStats(),
        this.analytics.getOccupancyByBuilding(),
      ]);
      this.stats = stats;
      this.occupancy = occupancy;
    } catch {
      // Analytics data unavailable
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }
}
