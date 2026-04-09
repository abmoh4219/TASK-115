import {
  Component, OnInit,
  ChangeDetectionStrategy, ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

import { DocumentService } from '../../core/services/document.service';
import { AuthService } from '../../core/services/auth.service';
import { DbService, Document as HpDocument, Resident } from '../../core/services/db.service';
import { DocumentReviewDrawerComponent } from './document-review-drawer.component';

// =====================================================
// DocumentQueueComponent — Compliance reviewer page
// Route: /documents (ComplianceGuard)
// =====================================================

interface QueueRow {
  doc:      HpDocument;
  resident: Resident | undefined;
  daysWaiting: number;
}

@Component({
  selector: 'app-document-queue',
  standalone: true,
  imports: [CommonModule, MatIconModule, DocumentReviewDrawerComponent],
  template: `
    <div class="queue-page">

      <!-- ── Header ───────────────────────────────── -->
      <div class="page-header">
        <div class="page-header__left">
          <h1 class="page-title">Document Review Queue</h1>
          <span class="pending-badge" *ngIf="pendingRows.length > 0">
            {{ pendingRows.length }}
          </span>
        </div>
        <p class="page-subtitle">
          Review and approve or reject resident document submissions.
        </p>
      </div>

      <!-- ── Loading ──────────────────────────────── -->
      <ng-container *ngIf="loading">
        <div class="skeleton-table">
          <div class="skeleton-row" *ngFor="let i of [1,2,3]"></div>
        </div>
      </ng-container>

      <!-- ── Empty state ───────────────────────────── -->
      <ng-container *ngIf="!loading && pendingRows.length === 0">
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" class="empty-icon">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke="#d1d5db" stroke-width="1.5" stroke-linecap="round"/>
            <polyline points="22 4 12 14.01 9 11.01" stroke="#d1d5db" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <h3>All clear</h3>
          <p>No documents pending review.</p>
        </div>
      </ng-container>

      <!-- ── Queue table ───────────────────────────── -->
      <div class="queue-table" *ngIf="!loading && pendingRows.length > 0">

        <!-- Table header -->
        <div class="table-header">
          <span class="col-resident">Resident</span>
          <span class="col-document">Document</span>
          <span class="col-type">Type</span>
          <span class="col-size">Size</span>
          <span class="col-waiting">Waiting</span>
          <span class="col-action"></span>
        </div>

        <!-- Rows -->
        <div
          class="table-row"
          *ngFor="let row of pendingRows"
          (click)="openReview(row)"
        >
          <!-- Resident -->
          <div class="col-resident">
            <div class="row-avatar" [style.background]="avatarBg(row.resident?.firstName ?? '?', row.resident?.lastName ?? '')">
              {{ (row.resident?.firstName ?? '?')[0] }}{{ (row.resident?.lastName ?? '')[0] }}
            </div>
            <div class="row-resident-info">
              <span class="row-resident-name">
                {{ row.resident ? row.resident.firstName + ' ' + row.resident.lastName : 'Unknown Resident' }}
              </span>
              <span class="row-resident-email">{{ row.resident?.email ?? '' }}</span>
            </div>
          </div>

          <!-- Document -->
          <div class="col-document">
            <div class="file-type-icon" [style.background]="fileIconBg(row.doc.mimeType)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
                <polyline points="14 2 14 8 20 8" stroke="currentColor" stroke-width="2"/>
              </svg>
            </div>
            <span class="row-filename">{{ row.doc.fileName }}</span>
          </div>

          <!-- Type -->
          <div class="col-type">
            <span class="type-tag">{{ friendlyType(row.doc.mimeType) }}</span>
          </div>

          <!-- Size -->
          <div class="col-size">{{ docService.formatSize(row.doc.sizeBytes) }}</div>

          <!-- Days waiting -->
          <div class="col-waiting">
            <span class="waiting-pill" [class]="waitingClass(row.daysWaiting)">
              <ng-container *ngIf="row.daysWaiting > 5">
                🔥&nbsp;
              </ng-container>
              {{ row.daysWaiting }}d
            </span>
          </div>

          <!-- Action -->
          <div class="col-action">
            <button class="btn-review" (click)="$event.stopPropagation(); openReview(row)">
              Review
            </button>
          </div>
        </div>

      </div>

      <!-- ── Review drawer ────────────────────────── -->
      <app-document-review-drawer
        [open]="reviewOpen"
        [document]="selectedDoc"
        [resident]="selectedResident"
        (closed)="reviewOpen = false"
        (reviewed)="onReviewed($event)"
      ></app-document-review-drawer>

    </div>
  `,
  styleUrls: ['./document-queue.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentQueueComponent implements OnInit {

  loading     = true;
  pendingRows: QueueRow[] = [];

  // Review drawer
  reviewOpen      = false;
  selectedDoc:     HpDocument | null = null;
  selectedResident: Resident | null = null;

  private readonly AVATAR_COLORS = [
    '#1e3a5f', '#0d9488', '#7c3aed', '#db2777',
    '#ea580c', '#16a34a', '#2563eb', '#b45309',
  ];

  constructor(
    readonly docService: DocumentService,
    private db:          DbService,
    private auth:        AuthService,
    private cdr:         ChangeDetectorRef,
    private route:       ActivatedRoute,
  ) {}

  ngOnInit(): void {
    this.loadQueue().then(() => this.handleDeepLink());
  }

  private handleDeepLink(): void {
    const highlightId = this.route.snapshot.queryParamMap.get('highlightId');
    if (highlightId) {
      const id = Number(highlightId);
      const match = this.pendingRows.find(r => r.doc.id === id);
      if (match) {
        this.openReview(match);
      }
    }
  }

  private async loadQueue(): Promise<void> {
    this.loading = true;
    this.cdr.markForCheck();
    try {
      const pending = await this.docService.getPendingReview();

      // Sort by urgency: oldest first
      pending.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      // Enrich with resident
      const now = Date.now();
      this.pendingRows = await Promise.all(
        pending.map(async (doc) => {
          const resident = await this.db.residents.get(doc.residentId);
          const daysWaiting = Math.floor((now - new Date(doc.createdAt).getTime()) / 86_400_000);
          return { doc, resident, daysWaiting };
        }),
      );
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  openReview(row: QueueRow): void {
    this.selectedDoc      = row.doc;
    this.selectedResident = row.resident ?? null;
    this.reviewOpen       = true;
    this.cdr.markForCheck();
  }

  onReviewed(doc: HpDocument): void {
    // Remove reviewed doc from pending list
    this.pendingRows = this.pendingRows.filter(r => r.doc.id !== doc.id);
    this.reviewOpen  = false;
    this.cdr.markForCheck();
  }

  // --------------------------------------------------
  // Helpers
  // --------------------------------------------------

  waitingClass(days: number): string {
    if (days <= 1) return 'waiting-pill--green';
    if (days <= 5) return 'waiting-pill--amber';
    return 'waiting-pill--red';
  }

  avatarBg(first: string, last: string): string {
    const name = `${first}${last}`;
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = (hash * 31 + name.charCodeAt(i)) & 0xffffffff;
    }
    return this.AVATAR_COLORS[Math.abs(hash) % this.AVATAR_COLORS.length];
  }

  fileIconBg(mimeType: string): string {
    if (mimeType === 'application/pdf') return '#ef4444';
    if (mimeType === 'image/jpeg')      return '#3b82f6';
    if (mimeType === 'image/png')       return '#10b981';
    return '#6b7280';
  }

  friendlyType(mime: string): string {
    switch (mime) {
      case 'application/pdf': return 'PDF';
      case 'image/jpeg':      return 'JPEG';
      case 'image/png':       return 'PNG';
      default:                return 'File';
    }
  }
}
