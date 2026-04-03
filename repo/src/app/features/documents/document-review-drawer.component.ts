import {
  Component, Input, Output, EventEmitter, OnChanges, SimpleChanges,
  ChangeDetectionStrategy, ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { DrawerComponent } from '../../shared/components/drawer/drawer.component';
import { ModalComponent } from '../../shared/components/modal/modal.component';
import { TextareaComponent } from '../../shared/components/forms/textarea.component';
import { ToastService } from '../../shared/components/toast/toast.service';

import { Document as HpDocument, Resident } from '../../core/services/db.service';
import { DocumentService } from '../../core/services/document.service';

// =====================================================
// DocumentReviewDrawerComponent
// Used by the compliance review queue.
// =====================================================

@Component({
  selector: 'app-document-review-drawer',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatButtonModule, MatIconModule,
    DrawerComponent, ModalComponent, TextareaComponent,
  ],
  template: `
    <app-drawer
      [open]="open"
      [title]="document?.fileName ?? 'Document Review'"
      [subtitle]="document ? docService.formatSize(document.sizeBytes) : ''"
      (closed)="closed.emit()"
    >
      <ng-container *ngIf="document && resident">

        <!-- ── Two-section layout ──────────────────── -->
        <div class="review-layout">

          <!-- Left 60%: file preview -->
          <div class="preview-panel">

            <div class="preview-label">Document Preview</div>

            <!-- Image preview -->
            <div class="preview-image-wrap" *ngIf="isImage && previewUrl">
              <img [src]="previewUrl" class="preview-image" [alt]="document.fileName" />
            </div>

            <!-- Loading preview -->
            <div class="preview-loading" *ngIf="isImage && !previewUrl && !previewError">
              <div class="preview-loading__spinner"></div>
              <p>Loading preview…</p>
            </div>

            <!-- PDF — can't render inline, offer download -->
            <div class="preview-pdf" *ngIf="!isImage">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" class="preview-pdf__icon">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
                      fill="rgba(239,68,68,0.08)" stroke="#ef4444" stroke-width="2" stroke-linejoin="round"/>
                <polyline points="14 2 14 8 20 8" stroke="#ef4444" stroke-width="2"/>
                <line x1="8" y1="13" x2="16" y2="13" stroke="#ef4444" stroke-width="2" stroke-linecap="round"/>
                <line x1="8" y1="17" x2="16" y2="17" stroke="#ef4444" stroke-width="2" stroke-linecap="round"/>
              </svg>
              <p class="preview-pdf__label">PDF Document</p>
              <p class="preview-pdf__name">{{ document.fileName }}</p>
              <button class="btn-outline" (click)="downloadFile()">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  <polyline points="7 10 12 15 17 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  <line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
                Download to Preview
              </button>
            </div>

            <!-- Error state -->
            <div class="preview-error" *ngIf="previewError">
              <p>Could not load preview.</p>
            </div>

          </div>

          <!-- Right 40%: resident info + decision -->
          <div class="decision-panel">

            <!-- Resident info card -->
            <div class="resident-card">
              <div
                class="resident-card__avatar"
                [style.background]="avatarBg(resident.firstName, resident.lastName)"
              >
                {{ resident.firstName[0] }}{{ resident.lastName[0] }}
              </div>
              <div class="resident-card__info">
                <p class="resident-card__name">{{ resident.firstName }} {{ resident.lastName }}</p>
                <p class="resident-card__email">{{ resident.email }}</p>
              </div>
            </div>

            <!-- Document metadata -->
            <div class="doc-meta-card">
              <div class="doc-meta-row">
                <span class="doc-meta-label">Uploaded</span>
                <span class="doc-meta-value">{{ document.createdAt | date:'MMM d, y' }}</span>
              </div>
              <div class="doc-meta-row">
                <span class="doc-meta-label">Type</span>
                <span class="doc-meta-value">{{ friendlyType(document.mimeType) }}</span>
              </div>
              <div class="doc-meta-row">
                <span class="doc-meta-label">Size</span>
                <span class="doc-meta-value">{{ docService.formatSize(document.sizeBytes) }}</span>
              </div>
              <div class="doc-meta-row">
                <span class="doc-meta-label">Status</span>
                <span class="status-badge" [class]="'status-badge--' + document.status">
                  {{ statusLabel(document.status) }}
                </span>
              </div>
            </div>

            <!-- Decision panel (only for pending) -->
            <ng-container *ngIf="document.status === 'pending_review'">

              <div class="decision-label">Decision</div>

              <!-- Reject form (expanded when rejectMode) -->
              <div class="reject-form" *ngIf="rejectMode">
                <app-textarea
                  label="Rejection reason"
                  [formControl]="rejectNotesCtrl"
                  placeholder="Explain why this document is rejected…"
                  [rows]="4"
                  [maxLength]="500"
                  [hint]="(rejectNotesCtrl.value?.length ?? 0) < 10 ? 'Minimum 10 characters required' : ''"
                ></app-textarea>
                <div class="reject-form__actions">
                  <button class="btn-ghost" (click)="cancelReject()" [disabled]="saving">
                    Cancel
                  </button>
                  <button
                    class="btn-reject"
                    (click)="confirmRejectModal = true"
                    [disabled]="saving || (rejectNotesCtrl.value?.length ?? 0) < 10"
                  >
                    {{ saving ? 'Submitting…' : 'Submit Rejection' }}
                  </button>
                </div>
              </div>

              <!-- Decision buttons -->
              <div class="decision-buttons" *ngIf="!rejectMode">
                <button class="btn-approve" (click)="confirmApproveModal = true" [disabled]="saving">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <polyline points="20 6 9 17 4 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                  Approve
                </button>
                <button class="btn-reject-outline" (click)="enterRejectMode()" [disabled]="saving">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
                    <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
                  </svg>
                  Reject
                </button>
              </div>

            </ng-container>

            <!-- Already reviewed -->
            <ng-container *ngIf="document.status !== 'pending_review'">
              <div class="already-reviewed">
                <p *ngIf="document.status === 'approved'" class="already-reviewed--approved">
                  This document has been approved.
                </p>
                <div *ngIf="document.status === 'rejected'">
                  <p class="already-reviewed--rejected">Rejected</p>
                  <p class="already-reviewed__notes" *ngIf="document.reviewNotes">{{ document.reviewNotes }}</p>
                </div>
              </div>
            </ng-container>

          </div>
        </div>

      </ng-container>
    </app-drawer>

    <!-- Confirm approve modal -->
    <app-modal
      [open]="confirmApproveModal"
      title="Approve Document"
      size="sm"
      confirmLabel="Approve"
      [loading]="saving"
      (confirmed)="executeApprove()"
      (cancelled)="confirmApproveModal = false"
    >
      <p style="font-size:0.9375rem;color:#374151;margin:0;">
        Approve <strong>{{ document?.fileName }}</strong>? This action is logged in the audit trail.
      </p>
    </app-modal>

    <!-- Confirm reject modal -->
    <app-modal
      [open]="confirmRejectModal"
      title="Reject Document"
      size="sm"
      type="danger"
      confirmLabel="Reject"
      [loading]="saving"
      (confirmed)="executeReject()"
      (cancelled)="confirmRejectModal = false"
    >
      <p style="font-size:0.9375rem;color:#374151;margin:0;">
        Reject <strong>{{ document?.fileName }}</strong>? The resident will see the rejection reason.
      </p>
    </app-modal>
  `,
  styles: [`
    :host { display: block; }

    // ── Two-section layout ─────────────────────────

    .review-layout {
      display: flex;
      gap: 1.25rem;
      padding: 1.25rem 1.5rem;
      height: 100%;
      overflow: auto;
    }

    // ── Preview panel (60%) ────────────────────────

    .preview-panel {
      flex: 3;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .preview-label {
      font-size: 0.6875rem;
      font-weight: 700;
      color: #9ca3af;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    .preview-image-wrap {
      flex: 1;
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 280px;
    }

    .preview-image {
      max-width: 100%;
      max-height: 500px;
      object-fit: contain;
      border-radius: 8px;
    }

    .preview-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      min-height: 200px;
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      color: #9ca3af;
      font-size: 0.875rem;
    }

    .preview-loading__spinner {
      width: 28px;
      height: 28px;
      border: 3px solid #e5e7eb;
      border-top-color: #2dd4bf;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    .preview-pdf {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.625rem;
      min-height: 240px;
      background: #fef2f2;
      border: 1px solid #fca5a5;
      border-radius: 12px;
      padding: 2rem;
      text-align: center;
    }

    .preview-pdf__label { font-size: 0.875rem; font-weight: 700; color: #991b1b; margin: 0; }
    .preview-pdf__name  { font-size: 0.8125rem; color: #6b7280; margin: 0; }

    .preview-error {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 120px;
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      color: #9ca3af;
      font-size: 0.875rem;
    }

    // ── Decision panel (40%) ───────────────────────

    .decision-panel {
      flex: 2;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    // ── Resident card ──────────────────────────────

    .resident-card {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.875rem;
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
    }

    .resident-card__avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.875rem;
      font-weight: 700;
      text-transform: uppercase;
      flex-shrink: 0;
    }

    .resident-card__name  { font-size: 0.9375rem; font-weight: 700; color: #111827; margin: 0 0 0.125rem; }
    .resident-card__email { font-size: 0.75rem; color: #6b7280; margin: 0; }

    // ── Doc metadata ───────────────────────────────

    .doc-meta-card {
      border: 1px solid #f3f4f6;
      border-radius: 10px;
      overflow: hidden;
    }

    .doc-meta-row {
      display: flex;
      align-items: center;
      padding: 0.5rem 0.875rem;
      border-bottom: 1px solid #f3f4f6;

      &:last-child { border-bottom: none; }
    }

    .doc-meta-label {
      width: 70px;
      flex-shrink: 0;
      font-size: 0.75rem;
      color: #9ca3af;
      font-weight: 500;
    }

    .doc-meta-value { font-size: 0.8125rem; color: #374151; font-weight: 500; }

    .status-badge {
      display: inline-flex;
      padding: 1px 8px;
      border-radius: 12px;
      font-size: 0.6875rem;
      font-weight: 700;

      &--pending_review { background: #fef3c7; color: #92400e; }
      &--approved        { background: #d1fae5; color: #065f46; }
      &--rejected        { background: #fee2e2; color: #991b1b; }
    }

    // ── Decision ───────────────────────────────────

    .decision-label {
      font-size: 0.6875rem;
      font-weight: 700;
      color: #9ca3af;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    .decision-buttons {
      display: flex;
      gap: 0.625rem;
    }

    .btn-approve {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.375rem;
      padding: 0.625rem;
      border: none;
      border-radius: 8px;
      background: #16a34a;
      color: #fff;
      font-size: 0.875rem;
      font-weight: 700;
      cursor: pointer;
      transition: background 150ms;

      &:hover:not(:disabled) { background: #15803d; }
      &:disabled { opacity: 0.5; cursor: default; }
    }

    .btn-reject-outline {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.375rem;
      padding: 0.625rem;
      border: 1px solid #fca5a5;
      border-radius: 8px;
      background: #fff;
      color: #dc2626;
      font-size: 0.875rem;
      font-weight: 700;
      cursor: pointer;
      transition: background 150ms;

      &:hover:not(:disabled) { background: #fef2f2; }
      &:disabled { opacity: 0.5; cursor: default; }
    }

    // ── Reject form ────────────────────────────────

    .reject-form {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .reject-form__actions {
      display: flex;
      gap: 0.5rem;
      justify-content: flex-end;
    }

    .btn-reject {
      padding: 0.5rem 1rem;
      border: none;
      border-radius: 6px;
      background: #dc2626;
      color: #fff;
      font-size: 0.8125rem;
      font-weight: 700;
      cursor: pointer;
      transition: background 150ms;

      &:hover:not(:disabled) { background: #b91c1c; }
      &:disabled { opacity: 0.5; cursor: default; }
    }

    // ── Buttons ────────────────────────────────────

    .btn-ghost {
      padding: 0.375rem 0.875rem;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      background: #fff;
      font-size: 0.8125rem;
      font-weight: 600;
      color: #374151;
      cursor: pointer;

      &:hover { background: #f9fafb; }
      &:disabled { opacity: 0.5; cursor: default; }
    }

    .btn-outline {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.5rem 1rem;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      background: #fff;
      font-size: 0.8125rem;
      font-weight: 600;
      color: #374151;
      cursor: pointer;
      margin-top: 0.25rem;
      transition: background 150ms;

      &:hover { background: #f9fafb; }
    }

    // ── Already reviewed ───────────────────────────

    .already-reviewed {
      padding: 0.75rem;
      background: #f9fafb;
      border-radius: 8px;
      font-size: 0.875rem;

      &--approved { color: #16a34a; font-weight: 700; margin: 0; }
      &--rejected { color: #dc2626; font-weight: 700; margin: 0 0 0.375rem; }

      &__notes {
        font-size: 0.8125rem;
        color: #374151;
        margin: 0;
        background: #fef2f2;
        padding: 0.625rem;
        border-radius: 6px;
        border: 1px solid #fca5a5;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentReviewDrawerComponent implements OnChanges {

  @Input() open     = false;
  @Input() document: HpDocument | null = null;
  @Input() resident: Resident  | null = null;
  @Input() actorId  = 0;
  @Input() actorRole = 'compliance';

  @Output() closed   = new EventEmitter<void>();
  @Output() reviewed = new EventEmitter<HpDocument>();

  // --------------------------------------------------
  // State
  // --------------------------------------------------

  previewUrl:   string | null = null;
  previewError  = false;
  saving        = false;
  rejectMode    = false;

  confirmApproveModal = false;
  confirmRejectModal  = false;

  rejectNotesCtrl = new FormControl('', [Validators.minLength(10)]);

  private currentPreviewUrl = '';

  private readonly AVATAR_COLORS = [
    '#1e3a5f', '#0d9488', '#7c3aed', '#db2777',
    '#ea580c', '#16a34a', '#2563eb', '#b45309',
  ];

  constructor(
    readonly docService: DocumentService,
    private toast:       ToastService,
    private cdr:         ChangeDetectorRef,
  ) {}

  // --------------------------------------------------
  // Lifecycle
  // --------------------------------------------------

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['document'] || changes['open']) {
      if (this.open && this.document) {
        this.resetState();
        this.loadPreview();
      } else if (!this.open) {
        this.revokePreview();
      }
    }
  }

  private resetState(): void {
    this.rejectMode    = false;
    this.saving        = false;
    this.previewUrl    = null;
    this.previewError  = false;
    this.rejectNotesCtrl.reset('');
    this.confirmApproveModal = false;
    this.confirmRejectModal  = false;
  }

  private async loadPreview(): Promise<void> {
    if (!this.document) return;
    this.previewError = false;
    this.cdr.markForCheck();
    try {
      const url = await this.docService.createPreviewUrl(this.document);
      this.revokePreview();
      this.currentPreviewUrl = url;
      this.previewUrl = url;
    } catch {
      this.previewError = true;
    } finally {
      this.cdr.markForCheck();
    }
  }

  private revokePreview(): void {
    if (this.currentPreviewUrl) {
      URL.revokeObjectURL(this.currentPreviewUrl);
      this.currentPreviewUrl = '';
      this.previewUrl = null;
    }
  }

  // --------------------------------------------------
  // Computed
  // --------------------------------------------------

  get isImage(): boolean {
    return this.document?.mimeType.startsWith('image/') ?? false;
  }

  avatarBg(first: string, last: string): string {
    const name = `${first}${last}`;
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = (hash * 31 + name.charCodeAt(i)) & 0xffffffff;
    }
    return this.AVATAR_COLORS[Math.abs(hash) % this.AVATAR_COLORS.length];
  }

  friendlyType(mime: string): string {
    switch (mime) {
      case 'application/pdf': return 'PDF';
      case 'image/jpeg':      return 'JPEG Image';
      case 'image/png':       return 'PNG Image';
      default:                return mime;
    }
  }

  statusLabel(status: string): string {
    switch (status) {
      case 'pending_review': return 'Pending Review';
      case 'approved':       return 'Approved';
      case 'rejected':       return 'Rejected';
      default:               return status;
    }
  }

  // --------------------------------------------------
  // Actions
  // --------------------------------------------------

  async executeApprove(): Promise<void> {
    if (!this.document?.id) return;
    this.saving = true;
    this.confirmApproveModal = false;
    this.cdr.markForCheck();
    try {
      const updated = await this.docService.reviewDocument(
        this.document.id, 'approved', '', this.actorId, this.actorRole,
      );
      this.reviewed.emit(updated);
      this.toast.show('Document approved.', 'success');
      this.closed.emit();
    } catch {
      this.toast.show('Failed to approve document.', 'error');
    } finally {
      this.saving = false;
      this.cdr.markForCheck();
    }
  }

  enterRejectMode(): void {
    this.rejectMode = true;
    this.rejectNotesCtrl.reset('');
  }

  cancelReject(): void {
    this.rejectMode = false;
    this.rejectNotesCtrl.reset('');
  }

  async executeReject(): Promise<void> {
    if (!this.document?.id) return;
    const notes = this.rejectNotesCtrl.value ?? '';
    if (notes.length < 10) return;

    this.saving = true;
    this.confirmRejectModal = false;
    this.cdr.markForCheck();
    try {
      const updated = await this.docService.reviewDocument(
        this.document.id, 'rejected', notes, this.actorId, this.actorRole,
      );
      this.reviewed.emit(updated);
      this.toast.show('Document rejected.', 'success');
      this.closed.emit();
    } catch {
      this.toast.show('Failed to reject document.', 'error');
    } finally {
      this.saving = false;
      this.cdr.markForCheck();
    }
  }

  async downloadFile(): Promise<void> {
    if (!this.document) return;
    try {
      const url = this.currentPreviewUrl || await this.docService.createPreviewUrl(this.document);
      const a   = Object.assign(window.document.createElement('a'), {
        href:     url,
        download: this.document.fileName,
      });
      a.click();
    } catch {
      this.toast.show('Could not prepare file for download.', 'error');
    }
  }
}
