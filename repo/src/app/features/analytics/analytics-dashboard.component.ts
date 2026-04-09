import {
  Component, OnInit, OnDestroy,
  ViewChild, ElementRef,
  ChangeDetectionStrategy, ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';

import { StatCardComponent } from '../../shared/components/stat-card/stat-card.component';

import {
  AnalyticsService,
  SummaryStats, BuildingOccupancy, WeeklyEnrollment,
  CourseEnrollmentStat, CompliancePipeline, DailyMessaging, CompareResult,
} from '../../core/services/analytics.service';
import { SearchService } from '../../core/services/search.service';
import { DbService, ZeroResultsLog, Building } from '../../core/services/db.service';

import {
  Chart, BarController, LineController, DoughnutController,
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Filler, Tooltip, Legend,
} from 'chart.js';

Chart.register(
  BarController, LineController, DoughnutController,
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Filler, Tooltip, Legend,
);

@Component({
  selector: 'app-analytics-dashboard',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatIconModule, MatButtonModule, MatTooltipModule,
    StatCardComponent,
  ],
  template: `
    <!-- ═══ Page ═══════════════════════════════════════ -->
    <div class="analytics-page">
      <div class="page-header">
        <h1 class="page-title">
          <mat-icon class="page-icon">analytics</mat-icon>
          Analytics
        </h1>
      </div>

      <!-- ═══ Sticky Sub-Nav ══════════════════════════ -->
      <div class="sub-nav">
        <button class="sub-nav__tab"
          [class.sub-nav__tab--active]="activeTab === 'dashboard'"
          (click)="switchTab('dashboard')">
          <mat-icon>dashboard</mat-icon> Dashboard
        </button>
        <button class="sub-nav__tab"
          [class.sub-nav__tab--active]="activeTab === 'compare'"
          (click)="switchTab('compare')">
          <mat-icon>compare_arrows</mat-icon> Compare
        </button>
      </div>

      <!-- ═══════════════════════════════════════════════ -->
      <!-- DASHBOARD TAB                                   -->
      <!-- ═══════════════════════════════════════════════ -->
      <div class="tab-content" *ngIf="activeTab === 'dashboard'">

        <!-- ── Summary Row ────────────────────────────── -->
        <div class="stat-row" *ngIf="!loading">
          <app-stat-card icon="people" label="Active Residents"
            [value]="animatedResidents"
            [trend]="stats?.activeResidentsDelta ?? null"
            trendLabel="vs last month"
            iconBg="#eef2ff" iconColor="#1e3a5f"></app-stat-card>
          <app-stat-card icon="school" label="Enrollments This Month"
            [value]="animatedEnrollments"
            [trend]="stats?.enrollmentsDelta ?? null"
            trendLabel="vs last month"
            iconBg="#f0fdfa" iconColor="#0d9488"></app-stat-card>
          <app-stat-card icon="pending_actions" label="Pending Reviews"
            [value]="animatedPending"
            [trend]="stats?.pendingReviewsDelta ?? null"
            trendLabel="vs last week"
            iconBg="#fffbeb" iconColor="#b45309"></app-stat-card>
          <app-stat-card icon="chat" label="Messages This Week"
            [value]="animatedMessages"
            [trend]="stats?.messagesDelta ?? null"
            trendLabel="vs last week"
            iconBg="#f0fdfa" iconColor="#2dd4bf"></app-stat-card>
        </div>
        <div class="stat-row" *ngIf="loading">
          <div class="skeleton-card" *ngFor="let _ of [1,2,3,4]">
            <div class="skel skel--circle"></div>
            <div class="skel skel--line-short"></div>
            <div class="skel skel--line-long"></div>
          </div>
        </div>

        <!-- ── Occupancy by Building ──────────────────── -->
        <div class="card">
          <div class="card__head">
            <h2 class="card__title">Occupancy by Building</h2>
            <span class="chip">Current</span>
          </div>
          <div class="card__split" *ngIf="!loading && occupancy.length > 0">
            <div class="card__chart-wrap card__chart-wrap--60">
              <canvas #occupancyChart></canvas>
            </div>
            <div class="card__side card__side--40">
              <table class="mini-table">
                <thead><tr><th>Building</th><th>Rooms</th><th>Occupied</th><th>Rate</th></tr></thead>
                <tbody>
                  <tr *ngFor="let b of occupancy">
                    <td>{{ b.buildingName }}</td>
                    <td>{{ b.totalRooms }}</td>
                    <td>{{ b.occupied }}</td>
                    <td [style.color]="b.rate >= 80 ? '#059669' : b.rate >= 50 ? '#b45309' : '#dc2626'">{{ b.rate }}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div class="card__empty" *ngIf="!loading && occupancy.length === 0">
            <mat-icon>apartment</mat-icon><span>No building data</span>
          </div>
          <div class="card__skeleton" *ngIf="loading"><div class="skel skel--chart"></div></div>
        </div>

        <!-- ── Enrollment Trends ──────────────────────── -->
        <div class="card">
          <div class="card__head">
            <h2 class="card__title">Enrollment Activity</h2>
            <span class="chip">Last 8 weeks</span>
          </div>
          <div *ngIf="!loading && enrollTrends.length > 0">
            <div class="card__chart-wrap"><canvas #enrollChart></canvas></div>
            <table class="mini-table mini-table--full">
              <thead><tr><th>Course</th><th>Enrolled</th><th>Waitlisted</th><th>Dropped</th><th>Completion</th></tr></thead>
              <tbody>
                <tr *ngFor="let c of courseStats">
                  <td>{{ c.title }}</td><td>{{ c.enrolled }}</td>
                  <td>{{ c.waitlisted }}</td><td>{{ c.dropped }}</td>
                  <td>{{ c.completionPct }}%</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="card__empty" *ngIf="!loading && enrollTrends.length === 0">
            <mat-icon>school</mat-icon><span>No enrollment data</span>
          </div>
          <div class="card__skeleton" *ngIf="loading"><div class="skel skel--chart"></div></div>
        </div>

        <!-- ── Search Health ──────────────────────────── -->
        <div class="card">
          <div class="card__head"><h2 class="card__title">Search Health</h2></div>
          <div class="card__split" *ngIf="!loading && (topSearches.length > 0 || zeroResults.length > 0)">
            <div class="card__chart-wrap card__chart-wrap--50">
              <h3 class="section-sub">Top Searches</h3>
              <canvas #searchChart></canvas>
            </div>
            <div class="card__side card__side--50">
              <h3 class="section-sub">Zero Results</h3>
              <div class="zero-list" *ngIf="zeroResults.length > 0">
                <div class="zero-row" *ngFor="let z of zeroResults">
                  <span class="zero-query">{{ z.query }}</span>
                  <span class="zero-time">{{ z.timestamp | date:'shortDate' }}</span>
                  <button class="icon-btn" matTooltip="Add to Dictionary" (click)="addToDictionary(z.query)">
                    <mat-icon>library_add</mat-icon>
                  </button>
                </div>
              </div>
              <div class="card__empty card__empty--sm" *ngIf="zeroResults.length === 0"><span>No zero-result queries</span></div>
            </div>
          </div>
          <div class="card__empty" *ngIf="!loading && topSearches.length === 0 && zeroResults.length === 0">
            <mat-icon>search</mat-icon><span>No search data</span>
          </div>
          <div class="card__skeleton" *ngIf="loading"><div class="skel skel--chart"></div></div>
        </div>

        <!-- ── Compliance Pipeline ────────────────────── -->
        <div class="card">
          <div class="card__head"><h2 class="card__title">Compliance Pipeline</h2></div>
          <div class="card__split" *ngIf="!loading && compliance">
            <div class="card__chart-wrap card__chart-wrap--50 doughnut-wrap">
              <canvas #complianceChart></canvas>
              <div class="doughnut-center">
                <span class="doughnut-total">{{ compliance.pending + compliance.approved + compliance.rejected }}</span>
                <span class="doughnut-label">Total</span>
              </div>
            </div>
            <div class="card__side card__side--50">
              <div class="stat-list">
                <div class="stat-list__row">
                  <span class="stat-list__lbl">Avg Review Time</span>
                  <span class="stat-list__val">{{ compliance.avgReviewHours }}h</span>
                </div>
                <div class="stat-list__row">
                  <span class="stat-list__lbl">Oldest Pending</span>
                  <span class="stat-list__val">{{ compliance.oldestPendingDays }}d</span>
                </div>
                <div class="stat-list__row">
                  <span class="stat-list__lbl">Approval Rate</span>
                  <span class="stat-list__val" style="color:#059669">{{ compliance.approvalRate }}%</span>
                </div>
                <div class="stat-list__row">
                  <span class="stat-list__lbl">Pending</span>
                  <span class="stat-list__val" style="color:#b45309">{{ compliance.pending }}</span>
                </div>
                <div class="stat-list__row">
                  <span class="stat-list__lbl">Approved</span>
                  <span class="stat-list__val" style="color:#059669">{{ compliance.approved }}</span>
                </div>
                <div class="stat-list__row">
                  <span class="stat-list__lbl">Rejected</span>
                  <span class="stat-list__val" style="color:#dc2626">{{ compliance.rejected }}</span>
                </div>
              </div>
            </div>
          </div>
          <div class="card__empty" *ngIf="!loading && !compliance">
            <mat-icon>assignment</mat-icon><span>No compliance data</span>
          </div>
          <div class="card__skeleton" *ngIf="loading"><div class="skel skel--chart"></div></div>
        </div>

        <!-- ── Messaging Activity ─────────────────────── -->
        <div class="card">
          <div class="card__head">
            <h2 class="card__title">Messaging Activity</h2>
            <span class="chip">Last 14 days</span>
          </div>
          <div *ngIf="!loading && messagingData.length > 0">
            <div class="card__chart-wrap"><canvas #messagingChart></canvas></div>
          </div>
          <div class="card__empty" *ngIf="!loading && messagingData.length === 0">
            <mat-icon>chat</mat-icon><span>No messaging data</span>
          </div>
          <div class="card__skeleton" *ngIf="loading"><div class="skel skel--chart"></div></div>
        </div>
      </div>

      <!-- ═══════════════════════════════════════════════ -->
      <!-- COMPARE TAB                                     -->
      <!-- ═══════════════════════════════════════════════ -->
      <div class="tab-content" *ngIf="activeTab === 'compare'">
        <div class="compare-builder">

          <!-- Step 1 -->
          <h2 class="step-title">1. Choose Dimension</h2>
          <div class="dim-cards">
            <div class="dim-card" [class.dim-card--active]="compareDimension === 'building'"
              (click)="compareDimension = 'building'; compareResult = null">
              <mat-icon class="dim-card__ic">apartment</mat-icon>
              <span class="dim-card__lbl">Building vs Building</span>
            </div>
            <div class="dim-card" [class.dim-card--active]="compareDimension === 'daterange'"
              (click)="compareDimension = 'daterange'; compareResult = null">
              <mat-icon class="dim-card__ic">date_range</mat-icon>
              <span class="dim-card__lbl">Date Range vs Date Range</span>
            </div>
          </div>

          <!-- Step 2 -->
          <ng-container *ngIf="compareDimension">
            <h2 class="step-title">2. Select Values</h2>
            <div class="sel-card">
              <div class="sel-row" *ngIf="compareDimension === 'building'">
                <div class="sel-field">
                  <label>Building A</label>
                  <select [(ngModel)]="buildingA" class="sel-input">
                    <option [ngValue]="null" disabled>Select…</option>
                    <option *ngFor="let b of buildings" [ngValue]="b.id">{{ b.name }}</option>
                  </select>
                </div>
                <span class="vs-pill">VS</span>
                <div class="sel-field">
                  <label>Building B</label>
                  <select [(ngModel)]="buildingB" class="sel-input">
                    <option [ngValue]="null" disabled>Select…</option>
                    <option *ngFor="let b of buildings" [ngValue]="b.id">{{ b.name }}</option>
                  </select>
                </div>
              </div>
              <div class="sel-row" *ngIf="compareDimension === 'daterange'">
                <div class="sel-field">
                  <label>Range A: From</label>
                  <input type="date" [(ngModel)]="dateFromA" class="sel-input" />
                </div>
                <div class="sel-field">
                  <label>Range A: To</label>
                  <input type="date" [(ngModel)]="dateToA" class="sel-input" />
                </div>
                <span class="vs-pill">VS</span>
                <div class="sel-field">
                  <label>Range B: From</label>
                  <input type="date" [(ngModel)]="dateFromB" class="sel-input" />
                </div>
                <div class="sel-field">
                  <label>Range B: To</label>
                  <input type="date" [(ngModel)]="dateToB" class="sel-input" />
                </div>
              </div>
            </div>
          </ng-container>

          <!-- Step 3 -->
          <ng-container *ngIf="compareDimension">
            <h2 class="step-title">3. Select Metric</h2>
            <div class="pill-row">
              <ng-container *ngIf="compareDimension === 'building'">
                <button class="pill" [class.pill--active]="compareMetric === 'occupancy'" (click)="compareMetric = 'occupancy'">Occupancy %</button>
                <button class="pill" [class.pill--active]="compareMetric === 'residents'" (click)="compareMetric = 'residents'">Residents</button>
                <button class="pill" [class.pill--active]="compareMetric === 'messages'" (click)="compareMetric = 'messages'">Messages</button>
              </ng-container>
              <ng-container *ngIf="compareDimension === 'daterange'">
                <button class="pill" [class.pill--active]="compareMetric === 'enrollments'" (click)="compareMetric = 'enrollments'">Enrollments</button>
                <button class="pill" [class.pill--active]="compareMetric === 'messages'" (click)="compareMetric = 'messages'">Messages</button>
                <button class="pill" [class.pill--active]="compareMetric === 'reviews'" (click)="compareMetric = 'reviews'">Reviews</button>
              </ng-container>
            </div>
          </ng-container>

          <!-- Action -->
          <div class="compare-actions" *ngIf="compareDimension && compareMetric">
            <button class="btn-teal" (click)="runCompare()" [disabled]="compareLoading">
              <mat-icon>insights</mat-icon> Compare
            </button>
          </div>

          <!-- Results -->
          <div class="compare-results" *ngIf="compareResult">
            <div class="result-pair">
              <div class="result-card" [class.result-card--winner]="compareResult.winner === 'a'">
                <span class="winner-badge" *ngIf="compareResult.winner === 'a'">Winner</span>
                <span class="result-lbl">{{ compareResult.labelA }}</span>
                <span class="result-val">{{ compareResult.metricA }}</span>
              </div>
              <div class="result-card" [class.result-card--winner]="compareResult.winner === 'b'">
                <span class="winner-badge" *ngIf="compareResult.winner === 'b'">Winner</span>
                <span class="result-lbl">{{ compareResult.labelB }}</span>
                <span class="result-val">{{ compareResult.metricB }}</span>
              </div>
            </div>
            <div class="compare-chart-wrap"><canvas #compareChart></canvas></div>
            <button class="link-btn" (click)="resetCompare()">Reset Comparison</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./analytics-dashboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnalyticsDashboardComponent implements OnInit, OnDestroy {

  @ViewChild('occupancyChart')  occupancyCanvas!:  ElementRef<HTMLCanvasElement>;
  @ViewChild('enrollChart')     enrollCanvas!:     ElementRef<HTMLCanvasElement>;
  @ViewChild('searchChart')     searchCanvas!:     ElementRef<HTMLCanvasElement>;
  @ViewChild('complianceChart') complianceCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('messagingChart')  messagingCanvas!:  ElementRef<HTMLCanvasElement>;
  @ViewChild('compareChart')    compareCanvas!:    ElementRef<HTMLCanvasElement>;

  activeTab: 'dashboard' | 'compare' = 'dashboard';
  loading = true;

  stats:          SummaryStats | null = null;
  occupancy:      BuildingOccupancy[] = [];
  enrollTrends:   WeeklyEnrollment[] = [];
  courseStats:    CourseEnrollmentStat[] = [];
  topSearches:    { term: string; count: number }[] = [];
  zeroResults:    ZeroResultsLog[] = [];
  compliance:     CompliancePipeline | null = null;
  messagingData:  DailyMessaging[] = [];

  animatedResidents   = 0;
  animatedEnrollments = 0;
  animatedPending     = 0;
  animatedMessages    = 0;

  // Compare
  compareDimension: 'building' | 'daterange' | null = null;
  compareMetric    = '';
  compareLoading   = false;
  compareResult:   CompareResult | null = null;
  buildings:       Building[] = [];
  buildingA:       number | null = null;
  buildingB:       number | null = null;
  dateFromA = '';  dateToA = '';
  dateFromB = '';  dateToB = '';

  private charts: Chart[] = [];

  constructor(
    private analytics:     AnalyticsService,
    private searchService: SearchService,
    private db:            DbService,
    private cdr:           ChangeDetectorRef,
  ) {}

  ngOnInit(): void { this.loadData(); }

  ngOnDestroy(): void { this.destroyCharts(); }

  switchTab(tab: 'dashboard' | 'compare'): void {
    this.activeTab = tab;
    if (tab === 'dashboard') {
      setTimeout(() => this.drawAllCharts(), 50);
    }
  }

  // --------------------------------------------------
  // Data
  // --------------------------------------------------

  private async loadData(): Promise<void> {
    this.loading = true;
    this.cdr.markForCheck();

    try {
      const [stats, occ, trends, courses, compliance, messaging, searches, zeros, bldgs] =
        await Promise.all([
          this.analytics.getSummaryStats(),
          this.analytics.getOccupancyByBuilding(),
          this.analytics.getEnrollmentTrends(8),
          this.analytics.getCourseEnrollmentStats(),
          this.analytics.getCompliancePipeline(),
          this.analytics.getMessagingActivity(14),
          this.searchService.getTrendingTerms(10),
          this.searchService.getZeroResultsReport(15),
          this.db.buildings.toArray(),
        ]);

      this.stats         = stats;
      this.occupancy     = occ;
      this.enrollTrends  = trends;
      this.courseStats    = courses;
      this.compliance    = compliance;
      this.messagingData = messaging;
      this.topSearches   = searches;
      this.zeroResults   = zeros;
      this.buildings     = bldgs;
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
      setTimeout(() => { this.drawAllCharts(); this.animateCounts(); }, 60);
    }
  }

  // --------------------------------------------------
  // Count-up
  // --------------------------------------------------

  private animateCounts(): void {
    if (!this.stats) return;
    this.countUp('animatedResidents',   this.stats.activeResidents,      600);
    this.countUp('animatedEnrollments', this.stats.enrollmentsThisMonth, 600);
    this.countUp('animatedPending',     this.stats.pendingReviews,       600);
    this.countUp('animatedMessages',    this.stats.messagesThisWeek,     600);
  }

  private countUp(
    field: 'animatedResidents' | 'animatedEnrollments' | 'animatedPending' | 'animatedMessages',
    target: number, dur: number,
  ): void {
    const step = Math.max(1, Math.ceil(target / (dur / 16)));
    let cur = 0;
    const tick = () => {
      cur = Math.min(cur + step, target);
      this[field] = cur;
      this.cdr.markForCheck();
      if (cur < target) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // --------------------------------------------------
  // Charts
  // --------------------------------------------------

  private destroyCharts(): void {
    this.charts.forEach(c => c.destroy());
    this.charts = [];
  }

  private drawAllCharts(): void {
    this.destroyCharts();
    this.drawOccupancy();
    this.drawEnrollment();
    this.drawSearch();
    this.drawCompliance();
    this.drawMessaging();
  }

  private drawOccupancy(): void {
    if (!this.occupancyCanvas || this.occupancy.length === 0) return;
    const ctx = this.occupancyCanvas.nativeElement.getContext('2d')!;
    this.charts.push(new Chart(ctx, {
      type: 'bar',
      data: {
        labels: this.occupancy.map(b => b.buildingName),
        datasets: [{
          label: 'Occupancy %',
          data: this.occupancy.map(b => b.rate),
          backgroundColor: 'rgba(45,212,191,0.75)',
          borderColor: '#2dd4bf', borderWidth: 1, borderRadius: 6,
        }],
      },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => `${c.raw}%` } } },
        scales: {
          x: { max: 100, grid: { color: '#f3f4f6' }, ticks: { color: '#1e3a5f', font: { weight: 'bold' as const } } },
          y: { grid: { display: false }, ticks: { color: '#1e3a5f', font: { weight: 'bold' as const } } },
        },
      },
    }));
  }

  private drawEnrollment(): void {
    if (!this.enrollCanvas || this.enrollTrends.length === 0) return;
    const ctx = this.enrollCanvas.nativeElement.getContext('2d')!;
    this.charts.push(new Chart(ctx, {
      type: 'line',
      data: {
        labels: this.enrollTrends.map(w => w.weekLabel),
        datasets: [{
          label: 'Enrolled',
          data: this.enrollTrends.map(w => w.enrolled),
          borderColor: '#2dd4bf',
          backgroundColor: 'rgba(45,212,191,0.12)',
          fill: true, tension: 0.4,
          pointBackgroundColor: '#1e3a5f', pointRadius: 4,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: '#f3f4f6' }, ticks: { color: '#6b7280' } },
          y: { beginAtZero: true, grid: { color: '#f3f4f6' }, ticks: { color: '#6b7280' } },
        },
      },
    }));
  }

  private drawSearch(): void {
    if (!this.searchCanvas || this.topSearches.length === 0) return;
    const ctx = this.searchCanvas.nativeElement.getContext('2d')!;
    this.charts.push(new Chart(ctx, {
      type: 'bar',
      data: {
        labels: this.topSearches.map(s => s.term),
        datasets: [{
          label: 'Searches', data: this.topSearches.map(s => s.count),
          backgroundColor: 'rgba(45,212,191,0.7)', borderColor: '#2dd4bf',
          borderWidth: 1, borderRadius: 4,
        }],
      },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: '#f3f4f6' }, ticks: { color: '#6b7280' } },
          y: { grid: { display: false }, ticks: { color: '#374151', font: { weight: 'bold' as const } } },
        },
      },
    }));
  }

  private drawCompliance(): void {
    if (!this.complianceCanvas || !this.compliance) return;
    const ctx = this.complianceCanvas.nativeElement.getContext('2d')!;
    this.charts.push(new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Pending', 'Approved', 'Rejected'],
        datasets: [{
          data: [this.compliance.pending, this.compliance.approved, this.compliance.rejected],
          backgroundColor: ['#fbbf24', '#2dd4bf', '#ef4444'], borderWidth: 0,
        }],
      },
      options: {
        responsive: true, cutout: '65%',
        plugins: { legend: { position: 'bottom', labels: { padding: 16, usePointStyle: true, pointStyle: 'circle' } } },
      },
    }));
  }

  private drawMessaging(): void {
    if (!this.messagingCanvas || this.messagingData.length === 0) return;
    const ctx = this.messagingCanvas.nativeElement.getContext('2d')!;
    this.charts.push(new Chart(ctx, {
      type: 'line',
      data: {
        labels: this.messagingData.map(d => d.dateLabel),
        datasets: [
          {
            label: 'Direct Messages',
            data: this.messagingData.map(d => d.direct),
            borderColor: '#1e3a5f', backgroundColor: 'rgba(30,58,95,0.08)',
            fill: true, tension: 0.4, pointRadius: 3,
          },
          {
            label: 'Announcements',
            data: this.messagingData.map(d => d.announcements),
            borderColor: '#2dd4bf', backgroundColor: 'rgba(45,212,191,0.08)',
            borderDash: [5, 5], fill: true, tension: 0.4, pointRadius: 3,
          },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'top', labels: { usePointStyle: true, pointStyle: 'circle', padding: 20 } } },
        scales: {
          x: { grid: { color: '#f3f4f6' }, ticks: { color: '#6b7280' } },
          y: { beginAtZero: true, grid: { color: '#f3f4f6' }, ticks: { color: '#6b7280' } },
        },
      },
    }));
  }

  // --------------------------------------------------
  // Compare
  // --------------------------------------------------

  async runCompare(): Promise<void> {
    this.compareLoading = true;
    this.compareResult  = null;
    this.cdr.markForCheck();

    try {
      if (this.compareDimension === 'building' && this.buildingA != null && this.buildingB != null) {
        this.compareResult = await this.analytics.compareBuildingMetric(
          this.buildingA, this.buildingB, this.compareMetric,
        );
      } else if (this.compareDimension === 'daterange') {
        this.compareResult = await this.analytics.compareDateRangeMetric(
          new Date(this.dateFromA), new Date(this.dateToA),
          new Date(this.dateFromB), new Date(this.dateToB),
          this.compareMetric,
        );
      }
    } finally {
      this.compareLoading = false;
      this.cdr.markForCheck();
      setTimeout(() => this.drawCompareChart(), 50);
    }
  }

  resetCompare(): void {
    this.compareResult    = null;
    this.compareDimension = null;
    this.compareMetric    = '';
    this.buildingA = null; this.buildingB = null;
    this.cdr.markForCheck();
  }

  private drawCompareChart(): void {
    if (!this.compareCanvas || !this.compareResult) return;
    const idx = this.charts.findIndex(c => c.canvas === this.compareCanvas?.nativeElement);
    if (idx >= 0) { this.charts[idx].destroy(); this.charts.splice(idx, 1); }

    const ctx = this.compareCanvas.nativeElement.getContext('2d')!;
    const r = this.compareResult;
    this.charts.push(new Chart(ctx, {
      type: 'bar',
      data: {
        labels: [r.metric],
        datasets: [
          { label: r.labelA, data: [r.metricA], backgroundColor: '#1e3a5f', borderRadius: 6 },
          { label: r.labelB, data: [r.metricB], backgroundColor: '#2dd4bf', borderRadius: 6 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'top', labels: { usePointStyle: true, pointStyle: 'circle' } } },
        scales: { x: { grid: { display: false } }, y: { beginAtZero: true, grid: { color: '#f3f4f6' } } },
      },
    }));
  }

  // --------------------------------------------------
  // Actions
  // --------------------------------------------------

  async addToDictionary(query: string): Promise<void> {
    await this.searchService.addDictionaryEntry({ term: query, synonyms: [], corrections: [] });
    this.zeroResults = this.zeroResults.filter(z => z.query !== query);
    this.cdr.markForCheck();
  }
}
