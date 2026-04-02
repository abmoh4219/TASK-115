import {
  Component, OnInit,
  ChangeDetectionStrategy, ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';

import { TableComponent, TableColumn } from '../../shared/components/table/table.component';
import { DrawerComponent } from '../../shared/components/drawer/drawer.component';
import { ModalComponent } from '../../shared/components/modal/modal.component';
import { RoleBadgeComponent } from '../../shared/components/role-badge/role-badge.component';

import { AuditService, AuditAction } from '../../core/services/audit.service';
import { AuditLog } from '../../core/services/db.service';
import { UserRole } from '../../core/services/auth.service';

// =====================================================
// AuditLogComponent
// =====================================================

@Component({
  selector: 'app-audit-log',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatIconModule, MatButtonModule, MatTooltipModule,
    TableComponent, DrawerComponent, ModalComponent, RoleBadgeComponent,
  ],
  template: `
    <div class="audit-page">
      <!-- Header -->
      <div class="page-header">
        <div class="header-left">
          <h1 class="page-title">
            <mat-icon class="page-icon">history</mat-icon>
            Audit Log
          </h1>
          <span class="entry-count">{{ filteredLogs.length }} entries</span>
        </div>
        <button class="btn-outline" (click)="exportModalOpen = true">
          <mat-icon>download</mat-icon> Export
        </button>
      </div>

      <!-- ═══ Filter Bar ══════════════════════════════ -->
      <div class="filter-bar">
        <div class="filter-field">
          <label>Actor</label>
          <input type="text" class="filter-input" placeholder="Search actor ID…"
            [(ngModel)]="filterActorSearch" (input)="applyFilters()" />
        </div>
        <div class="filter-field">
          <label>Role</label>
          <select class="filter-input" [(ngModel)]="filterRole" (change)="applyFilters()">
            <option value="">All</option>
            <option value="admin">Admin</option>
            <option value="resident">Resident</option>
            <option value="compliance">Compliance</option>
            <option value="analyst">Analyst</option>
          </select>
        </div>
        <div class="filter-field">
          <label>Action</label>
          <select class="filter-input filter-input--wide" [(ngModel)]="filterAction" (change)="applyFilters()">
            <option value="">All</option>
            <option *ngFor="let a of actionOptions" [value]="a">{{ a }}</option>
          </select>
        </div>
        <div class="filter-field">
          <label>From</label>
          <input type="date" class="filter-input" [(ngModel)]="filterDateFrom" (change)="applyFilters()" />
        </div>
        <div class="filter-field">
          <label>To</label>
          <input type="date" class="filter-input" [(ngModel)]="filterDateTo" (change)="applyFilters()" />
        </div>
        <div class="filter-field filter-field--toggle">
          <button class="anomaly-toggle" [class.anomaly-toggle--active]="filterAnomalyOnly"
            (click)="filterAnomalyOnly = !filterAnomalyOnly; applyFilters()"
            matTooltip="Show anomaly-flagged only">
            <mat-icon>warning</mat-icon>
            Anomaly
          </button>
        </div>
      </div>

      <!-- ═══ Table ═══════════════════════════════════ -->
      <div class="table-wrap">
        <table class="audit-table">
          <thead>
            <tr>
              <th class="th-ts">Timestamp</th>
              <th class="th-role">Role</th>
              <th class="th-actor">Actor</th>
              <th class="th-action">Action</th>
              <th class="th-target">Target</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let log of pagedLogs; let i = index"
              class="audit-row"
              [class.audit-row--anomaly]="log.anomalyFlagged"
              [class.audit-row--alt]="i % 2 === 1"
              (click)="openDetail(log)">
              <td class="cell-ts">{{ log.timestamp | date:'MMM d, y h:mm a' }}</td>
              <td><app-role-badge [role]="asRole(log.actorRole)"></app-role-badge></td>
              <td class="cell-actor">{{ log.actorId }}</td>
              <td><span class="action-chip">{{ log.action }}</span></td>
              <td class="cell-target">{{ log.targetType }}:{{ log.targetId }}</td>
            </tr>
            <tr *ngIf="pagedLogs.length === 0">
              <td colspan="5" class="empty-row">
                <mat-icon>inbox</mat-icon>
                No audit entries match the current filters.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div class="pagination" *ngIf="filteredLogs.length > pageSize">
        <button class="page-btn" [disabled]="currentPage === 0" (click)="currentPage = currentPage - 1; paginate()">
          <mat-icon>chevron_left</mat-icon>
        </button>
        <span class="page-info">{{ currentPage * pageSize + 1 }}–{{ pageEnd }} of {{ filteredLogs.length }}</span>
        <button class="page-btn" [disabled]="pageEnd >= filteredLogs.length" (click)="currentPage = currentPage + 1; paginate()">
          <mat-icon>chevron_right</mat-icon>
        </button>
      </div>

      <!-- ═══ Detail Drawer ═══════════════════════════ -->
      <app-drawer
        [open]="drawerOpen"
        [title]="selectedLog ? selectedLog.action : ''"
        subtitle="Audit Entry Detail"
        (closed)="drawerOpen = false">

        <ng-container *ngIf="selectedLog">
          <div class="detail-section">
            <div class="detail-row">
              <span class="detail-label">Timestamp</span>
              <span class="detail-val">{{ selectedLog.timestamp | date:'medium' }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Actor</span>
              <span class="detail-val">
                <app-role-badge [role]="asRole(selectedLog.actorRole)"></app-role-badge>
                &nbsp; ID {{ selectedLog.actorId }}
              </span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Action</span>
              <span class="action-chip">{{ selectedLog.action }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Target</span>
              <span class="detail-val">{{ selectedLog.targetType }} : {{ selectedLog.targetId }}</span>
            </div>
            <div class="detail-row" *ngIf="selectedLog.anomalyFlagged">
              <span class="detail-label">Anomaly</span>
              <span class="anomaly-flag"><mat-icon>warning</mat-icon> Flagged</span>
            </div>
          </div>

          <!-- Before / After diff -->
          <div class="diff-section" *ngIf="selectedLog.before || selectedLog.after">
            <h3 class="diff-title">State Changes</h3>
            <div class="diff-grid">
              <div class="diff-card diff-card--before" *ngIf="selectedLog.before">
                <h4 class="diff-card__head">Before</h4>
                <pre class="diff-json">{{ formatJson(selectedLog.before) }}</pre>
              </div>
              <div class="diff-card diff-card--after" *ngIf="selectedLog.after">
                <h4 class="diff-card__head">After</h4>
                <pre class="diff-json">{{ formatJson(selectedLog.after) }}</pre>
              </div>
            </div>
          </div>
        </ng-container>
      </app-drawer>

      <!-- ═══ Export Modal ═════════════════════════════ -->
      <app-modal
        [open]="exportModalOpen"
        title="Export Audit Log"
        type="warning"
        confirmLabel="Export"
        (confirmed)="doExport()"
        (cancelled)="exportModalOpen = false">
        <div class="export-warn">
          <mat-icon class="warn-icon">shield</mat-icon>
          <p>
            You are about to export <strong>{{ filteredLogs.length }}</strong> audit log entries as JSON.
            This may contain sensitive operational data. Handle with care.
          </p>
        </div>
      </app-modal>
    </div>
  `,
  styles: [`
    .audit-page { padding: 1.5rem 2rem 3rem; max-width: 1400px; margin: 0 auto; }
    .page-header {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 1.25rem;
    }
    .header-left { display: flex; align-items: center; gap: 1rem; }
    .page-title {
      display: flex; align-items: center; gap: 0.5rem;
      font-size: 1.5rem; font-weight: 800; color: #1e3a5f; margin: 0;
    }
    .page-icon { font-size: 1.75rem; width: 1.75rem; height: 1.75rem; color: #2dd4bf; }
    .entry-count {
      font-size: 0.8125rem; color: #6b7280; font-weight: 500;
      background: #f3f4f6; padding: 0.2rem 0.625rem; border-radius: 999px;
    }

    .btn-outline {
      display: inline-flex; align-items: center; gap: 0.375rem;
      padding: 0.5rem 1rem; border: 1px solid #e5e7eb; border-radius: 8px;
      background: #fff; font-size: 0.8125rem; font-weight: 600;
      color: #374151; cursor: pointer; transition: all 150ms;
    }
    .btn-outline:hover { border-color: #1e3a5f; background: #f9fafb; }
    .btn-outline mat-icon { font-size: 1rem; width: 1rem; height: 1rem; }

    /* Filter bar */
    .filter-bar {
      display: flex; gap: 0.75rem; flex-wrap: wrap; align-items: flex-end;
      background: #fff; border: 1px solid #f3f4f6; border-radius: 12px;
      padding: 1rem 1.25rem; margin-bottom: 1rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    }
    .filter-field { display: flex; flex-direction: column; gap: 0.25rem; }
    .filter-field label { font-size: 0.7rem; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
    .filter-field--toggle { align-self: flex-end; }
    .filter-input {
      padding: 0.4375rem 0.625rem; border: 1px solid #e5e7eb; border-radius: 6px;
      font-size: 0.8125rem; color: #374151; background: #fff; outline: none;
      min-width: 120px;
    }
    .filter-input:focus { border-color: #2dd4bf; box-shadow: 0 0 0 2px rgba(45,212,191,0.15); }
    .filter-input--wide { min-width: 200px; }

    .anomaly-toggle {
      display: inline-flex; align-items: center; gap: 0.25rem;
      padding: 0.4375rem 0.75rem; border: 1px solid #e5e7eb; border-radius: 6px;
      background: #fff; font-size: 0.8125rem; font-weight: 600; color: #6b7280;
      cursor: pointer; transition: all 150ms;
    }
    .anomaly-toggle mat-icon { font-size: 1rem; width: 1rem; height: 1rem; }
    .anomaly-toggle:hover { border-color: #fbbf24; }
    .anomaly-toggle--active {
      background: #fef2f2; border-color: #ef4444; color: #dc2626;
    }

    /* Table */
    .table-wrap {
      background: #fff; border: 1px solid #f3f4f6; border-radius: 12px;
      overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    }
    .audit-table { width: 100%; border-collapse: collapse; font-size: 0.8125rem; }
    .audit-table th {
      text-align: left; padding: 0.75rem 1rem;
      font-size: 0.7rem; font-weight: 700; color: #6b7280;
      text-transform: uppercase; letter-spacing: 0.04em;
      background: #f9fafb; border-bottom: 2px solid #f3f4f6;
    }
    .th-ts { min-width: 170px; }
    .th-role { width: 100px; }
    .th-actor { width: 80px; }
    .th-action { min-width: 200px; }
    .th-target { min-width: 150px; }

    .audit-row {
      cursor: pointer; transition: background 100ms;
    }
    .audit-row:hover { background: #f9fafb; }
    .audit-row--alt { background: #fafbfc; }
    .audit-row--alt:hover { background: #f3f4f6; }
    .audit-row--anomaly {
      border-left: 4px solid #fbbf24;
      background: #fffbeb !important;
    }
    .audit-row--anomaly:hover { background: #fef3c7 !important; }

    .audit-table td { padding: 0.625rem 1rem; color: #374151; border-bottom: 1px solid #f9fafb; }
    .cell-ts { color: #6b7280; font-size: 0.75rem; white-space: nowrap; }
    .cell-actor { font-weight: 600; }
    .cell-target { color: #6b7280; font-size: 0.75rem; }

    .action-chip {
      display: inline-block; padding: 0.15rem 0.5rem;
      border-radius: 4px; background: #f3f4f6;
      font-family: 'SF Mono', 'Fira Code', monospace;
      font-size: 0.7rem; font-weight: 600; color: #374151;
    }

    .empty-row {
      text-align: center; padding: 2.5rem 1rem !important;
      color: #9ca3af; font-size: 0.875rem;
    }
    .empty-row mat-icon {
      display: block; margin: 0 auto 0.5rem;
      font-size: 2rem; width: 2rem; height: 2rem; opacity: 0.4;
    }

    /* Pagination */
    .pagination {
      display: flex; align-items: center; justify-content: center;
      gap: 0.75rem; padding: 1rem 0;
    }
    .page-btn {
      display: inline-flex; align-items: center; justify-content: center;
      width: 32px; height: 32px; border: 1px solid #e5e7eb; border-radius: 6px;
      background: #fff; cursor: pointer; color: #374151;
    }
    .page-btn:disabled { opacity: 0.4; cursor: default; }
    .page-btn mat-icon { font-size: 1.125rem; width: 1.125rem; height: 1.125rem; }
    .page-info { font-size: 0.8125rem; color: #6b7280; }

    /* Detail drawer */
    .detail-section {
      display: flex; flex-direction: column; gap: 0;
      border: 1px solid #f3f4f6; border-radius: 10px; overflow: hidden;
      margin-bottom: 1.5rem;
    }
    .detail-row {
      display: flex; justify-content: space-between; align-items: center;
      padding: 0.75rem 1rem; border-bottom: 1px solid #f3f4f6;
    }
    .detail-row:last-child { border-bottom: none; }
    .detail-label { font-size: 0.75rem; font-weight: 600; color: #6b7280; text-transform: uppercase; }
    .detail-val { font-size: 0.875rem; color: #374151; }
    .anomaly-flag {
      display: inline-flex; align-items: center; gap: 0.25rem;
      color: #dc2626; font-weight: 600; font-size: 0.8125rem;
    }
    .anomaly-flag mat-icon { font-size: 1rem; width: 1rem; height: 1rem; }

    /* Diff view */
    .diff-section { margin-top: 0.5rem; }
    .diff-title { font-size: 0.875rem; font-weight: 700; color: #1e3a5f; margin: 0 0 0.75rem; }
    .diff-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
    .diff-card {
      border-radius: 10px; padding: 0.75rem; overflow: auto; max-height: 300px;
    }
    .diff-card--before { background: #fef2f2; border: 1px solid #fecaca; }
    .diff-card--after { background: #f0fdf4; border: 1px solid #bbf7d0; }
    .diff-card__head {
      font-size: 0.7rem; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.04em; margin: 0 0 0.5rem;
    }
    .diff-card--before .diff-card__head { color: #dc2626; }
    .diff-card--after .diff-card__head { color: #16a34a; }
    .diff-json {
      font-family: 'SF Mono', 'Fira Code', monospace;
      font-size: 0.75rem; line-height: 1.5; color: #374151;
      white-space: pre-wrap; word-break: break-word; margin: 0;
    }

    /* Export modal */
    .export-warn {
      display: flex; align-items: flex-start; gap: 0.75rem;
      padding: 0.5rem 0;
    }
    .warn-icon { color: #b45309; font-size: 1.5rem; width: 1.5rem; height: 1.5rem; flex-shrink: 0; margin-top: 2px; }
    .export-warn p { margin: 0; font-size: 0.875rem; color: #374151; line-height: 1.5; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuditLogComponent implements OnInit {

  allLogs:      AuditLog[] = [];
  filteredLogs: AuditLog[] = [];
  pagedLogs:    AuditLog[] = [];
  loading       = true;

  // Filters
  filterActorSearch = '';
  filterRole        = '';
  filterAction      = '';
  filterDateFrom    = '';
  filterDateTo      = '';
  filterAnomalyOnly = false;

  actionOptions: string[] = Object.values(AuditAction);

  // Pagination
  pageSize    = 25;
  currentPage = 0;

  get pageEnd(): number {
    return Math.min((this.currentPage + 1) * this.pageSize, this.filteredLogs.length);
  }

  // Detail drawer
  drawerOpen  = false;
  selectedLog: AuditLog | null = null;

  // Export modal
  exportModalOpen = false;

  constructor(
    private auditService: AuditService,
    private cdr:          ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadLogs();
  }

  // --------------------------------------------------
  // Load
  // --------------------------------------------------

  private async loadLogs(): Promise<void> {
    this.loading = true;
    this.cdr.markForCheck();

    this.allLogs = await this.auditService.getLogs();
    this.applyFilters();

    this.loading = false;
    this.cdr.markForCheck();
  }

  // --------------------------------------------------
  // Filters
  // --------------------------------------------------

  applyFilters(): void {
    let logs = [...this.allLogs];

    if (this.filterActorSearch.trim()) {
      const search = this.filterActorSearch.trim().toLowerCase();
      logs = logs.filter(l => String(l.actorId).includes(search));
    }
    if (this.filterRole) {
      logs = logs.filter(l => l.actorRole === this.filterRole);
    }
    if (this.filterAction) {
      logs = logs.filter(l => l.action === this.filterAction);
    }
    if (this.filterDateFrom) {
      const from = new Date(this.filterDateFrom);
      logs = logs.filter(l => l.timestamp >= from);
    }
    if (this.filterDateTo) {
      const to = new Date(this.filterDateTo);
      to.setHours(23, 59, 59, 999);
      logs = logs.filter(l => l.timestamp <= to);
    }
    if (this.filterAnomalyOnly) {
      logs = logs.filter(l => l.anomalyFlagged);
    }

    this.filteredLogs = logs;
    this.currentPage  = 0;
    this.paginate();
    this.cdr.markForCheck();
  }

  paginate(): void {
    const start = this.currentPage * this.pageSize;
    this.pagedLogs = this.filteredLogs.slice(start, start + this.pageSize);
    this.cdr.markForCheck();
  }

  // --------------------------------------------------
  // Detail drawer
  // --------------------------------------------------

  openDetail(log: AuditLog): void {
    this.selectedLog = log;
    this.drawerOpen  = true;
    this.cdr.markForCheck();
  }

  formatJson(value: unknown): string {
    try { return JSON.stringify(value, null, 2); }
    catch { return String(value); }
  }

  asRole(role: string): UserRole | null {
    const valid: UserRole[] = ['admin', 'resident', 'compliance', 'analyst'];
    return valid.includes(role as UserRole) ? role as UserRole : null;
  }

  // --------------------------------------------------
  // Export
  // --------------------------------------------------

  doExport(): void {
    const data = JSON.stringify(this.filteredLogs, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `harborpoint-audit-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.exportModalOpen = false;
    this.cdr.markForCheck();
  }
}
