import {
  Component, Input, Output, EventEmitter, OnChanges, SimpleChanges,
  ChangeDetectionStrategy, ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import { DocumentService } from '../../core/services/document.service';
import { Document as HpDocument } from '../../core/services/db.service';
import { ToastService } from '../../shared/components/toast/toast.service';
import { ConsentModalComponent } from './consent-modal.component';

// =====================================================
// DocumentUploadComponent
//
// Self-contained: upload zone + document card list.
// Handles consent modal flow internally.
// Used in ResidentDrawer (Documents tab) and MyProfile.
// =====================================================

@Component({
  selector: 'app-document-upload',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatTooltipModule, ConsentModalComponent],
  template: `
    <!-- Consent Modal -->
    <app-consent-modal
      [open]="consentModalOpen"
      [policyVersion]="docService.POLICY_VERSION"
      (confirmed)="onConsentConfirmed()"
      (cancelled)="consentModalOpen = false"
    ></app-consent-modal>

    <div class="doc-upload">

      <!-- ── Loading state ──────────────────────────── -->
      <ng-container *ngIf="loading">
        <div class="loading-row">
          <div class="skeleton-line skeleton-line--full"></div>
          <div class="skeleton-line skeleton-line--full"></div>
        </div>
      </ng-container>

      <ng-container *ngIf="!loading">

        <!-- ── Upload zone ────────────────────────────── -->
        <ng-container *ngIf="!readonly">

          <!-- At limit -->
          <div class="upload-zone upload-zone--locked" *ngIf="atLimit">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="11" width="18" height="11" rx="2" stroke="#f59e0b" stroke-width="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="#f59e0b" stroke-width="2" stroke-linecap="round"/>
            </svg>
            <span class="upload-zone__locked-text">Maximum 5 documents reached</span>
          </div>

          <!-- File selected: preview card -->
          <ng-container *ngIf="!atLimit && pendingFile">
            <div class="file-preview-card">
              <div class="file-preview-card__icon" [style.background]="fileIconBg(pendingFile.type)">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
                  <polyline points="14 2 14 8 20 8" stroke="currentColor" stroke-width="2"/>
                </svg>
              </div>
              <div class="file-preview-card__info">
                <p class="file-preview-card__name">{{ pendingFile.name }}</p>
                <p class="file-preview-card__size">{{ docService.formatSize(pendingFile.size) }}</p>
              </div>
              <button
                class="file-preview-card__remove"
                [matTooltip]="'Remove'"
                (click)="removePending()"
                [disabled]="uploading"
              >×</button>
            </div>

            <!-- Progress bar -->
            <div class="progress-wrap" *ngIf="uploading">
              <div class="progress-bar">
                <div class="progress-bar__fill" [style.width.%]="uploadProgress"></div>
              </div>
              <span class="progress-label">Uploading…</span>
            </div>

            <div class="upload-actions">
              <button class="btn-ghost" (click)="removePending()" [disabled]="uploading">Cancel</button>
              <button class="btn-teal" (click)="startUpload()" [disabled]="uploading">
                {{ uploading ? 'Uploading…' : 'Upload Document' }}
              </button>
            </div>
          </ng-container>

          <!-- Drop zone (default) -->
          <div
            *ngIf="!atLimit && !pendingFile"
            class="upload-zone"
            [class.upload-zone--hover]="dragOver"
            (dragover)="$event.preventDefault(); dragOver = true"
            (dragleave)="dragOver = false"
            (drop)="onDrop($event)"
            (click)="fileInput.click()"
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" class="upload-zone__icon">
              <polyline points="16 16 12 12 8 16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <line x1="12" y1="12" x2="12" y2="21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <p class="upload-zone__text">Drag &amp; drop or <span class="upload-zone__browse">click to browse</span></p>
            <p class="upload-zone__hint">PDF, JPG or PNG &nbsp;·&nbsp; max 10 MB</p>
          </div>

          <input
            #fileInput
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            style="display:none"
            (change)="onFileSelected($event)"
          />

        </ng-container>

        <!-- ── Document list ──────────────────────────── -->
        <div class="doc-list" *ngIf="documents.length > 0">

          <div
            class="doc-card"
            *ngFor="let doc of documents"
            [class.doc-card--hidden]="doc.hidden"
          >
            <div class="doc-card__icon" [style.background]="fileIconBg(doc.mimeType)">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
                <polyline points="14 2 14 8 20 8" stroke="currentColor" stroke-width="2"/>
              </svg>
            </div>

            <div class="doc-card__body">
              <div class="doc-card__top">
                <span class="doc-card__name" [class.doc-card__name--hidden]="doc.hidden">
                  {{ doc.fileName }}
                </span>
                <span class="doc-card__badge" [class]="statusClass(doc)">
                  <ng-container [ngSwitch]="doc.status">
                    <ng-container *ngSwitchCase="'pending_review'">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                        <polyline points="12 6 12 12 16 14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                      </svg>
                      Pending Review
                    </ng-container>
                    <ng-container *ngSwitchCase="'approved'">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                        <polyline points="20 6 9 17 4 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                      Approved
                    </ng-container>
                    <ng-container *ngSwitchCase="'rejected'">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                        <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
                        <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
                      </svg>
                      Rejected
                    </ng-container>
                  </ng-container>
                </span>
              </div>

              <div class="doc-card__meta">
                <span>{{ docService.formatSize(doc.sizeBytes) }}</span>
                <span>·</span>
                <span>{{ doc.createdAt | date:'MMM d, y' }}</span>
              </div>

              <!-- Hidden label -->
              <p class="doc-card__hidden-label" *ngIf="doc.hidden">
                Hidden — consent revoked
              </p>

              <!-- Rejected: review notes -->
              <div class="doc-card__reject-notes" *ngIf="doc.status === 'rejected' && doc.reviewNotes && !doc.hidden">
                <div class="reject-notes-body">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" class="reject-notes-icon">
                    <circle cx="12" cy="12" r="10" stroke="#dc2626" stroke-width="2"/>
                    <line x1="12" y1="8" x2="12" y2="12" stroke="#dc2626" stroke-width="2" stroke-linecap="round"/>
                    <line x1="12" y1="16" x2="12.01" y2="16" stroke="#dc2626" stroke-width="2" stroke-linecap="round"/>
                  </svg>
                  <p class="reject-notes-text">{{ doc.reviewNotes }}</p>
                </div>
              </div>

            </div>
          </div>

        </div>

        <!-- ── Empty state ─────────────────────────────── -->
        <div class="doc-empty" *ngIf="!readonly && documents.length === 0 && !atLimit">
          <p>No documents uploaded yet. Use the area above to add files.</p>
        </div>
        <div class="doc-empty" *ngIf="readonly && documents.length === 0">
          <p>No documents on file.</p>
        </div>

      </ng-container>

    </div>
  `,
  styles: [`
    :host { display: block; }

    .doc-upload {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    /* ── Upload zone ──────────────────────────────── */

    .upload-zone {
      height: 200px;
      border: 2px dashed #e5e7eb;
      border-radius: 12px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.625rem;
      cursor: pointer;
      transition: border-color 200ms, background 200ms;
      background: #fafafa;

      &:hover,
      &--hover {
        border-color: #2dd4bf;
        border-style: solid;
        background: rgba(45,212,191,0.04);

        .upload-zone__icon { color: #2dd4bf; }
      }

      &--locked {
        height: auto;
        min-height: 80px;
        border-color: #fcd34d;
        background: #fffbeb;
        flex-direction: row;
        gap: 0.625rem;
        padding: 1.25rem;
        cursor: default;
      }
    }

    .upload-zone__icon {
      color: #d1d5db;
      transition: color 200ms;
    }

    .upload-zone__text {
      font-size: 0.9375rem;
      color: #374151;
      font-weight: 500;
      margin: 0;
    }

    .upload-zone__browse {
      color: #2dd4bf;
      font-weight: 700;
      text-decoration: underline;
      text-decoration-style: dotted;
    }

    .upload-zone__hint {
      font-size: 0.75rem;
      color: #9ca3af;
      margin: 0;
    }

    .upload-zone__locked-text {
      font-size: 0.875rem;
      font-weight: 600;
      color: #92400e;
    }

    /* ── File preview card ────────────────────────── */

    .file-preview-card {
      display: flex;
      align-items: center;
      gap: 0.875rem;
      padding: 0.875rem 1rem;
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
    }

    .file-preview-card__icon {
      width: 40px;
      height: 40px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      color: #fff;
    }

    .file-preview-card__info { flex: 1; min-width: 0; }

    .file-preview-card__name {
      font-size: 0.875rem;
      font-weight: 600;
      color: #111827;
      margin: 0 0 0.125rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .file-preview-card__size {
      font-size: 0.75rem;
      color: #9ca3af;
      margin: 0;
    }

    .file-preview-card__remove {
      width: 28px;
      height: 28px;
      border: none;
      background: none;
      color: #9ca3af;
      font-size: 1.25rem;
      cursor: pointer;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      line-height: 1;
      transition: background 150ms, color 150ms;

      &:hover { background: #fee2e2; color: #dc2626; }
      &:disabled { opacity: 0.4; cursor: default; }
    }

    /* ── Progress bar ─────────────────────────────── */

    .progress-wrap {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .progress-bar {
      flex: 1;
      height: 4px;
      background: #e5e7eb;
      border-radius: 2px;
      overflow: hidden;
    }

    .progress-bar__fill {
      height: 100%;
      background: linear-gradient(90deg, #2dd4bf, #0d9488);
      border-radius: 2px;
      transition: width 100ms linear;
    }

    .progress-label {
      font-size: 0.75rem;
      color: #6b7280;
      white-space: nowrap;
    }

    /* ── Upload actions ───────────────────────────── */

    .upload-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
    }

    /* ── Document list ────────────────────────────── */

    .doc-list {
      display: flex;
      flex-direction: column;
      gap: 0.625rem;
    }

    .doc-card {
      display: flex;
      align-items: flex-start;
      gap: 0.875rem;
      padding: 0.875rem 1rem;
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      transition: box-shadow 150ms;

      &:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.07); }

      &--hidden {
        opacity: 0.55;
        background: #f9fafb;
        border-style: dashed;
      }
    }

    .doc-card__icon {
      width: 40px;
      height: 40px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      color: #fff;
    }

    .doc-card__body { flex: 1; min-width: 0; }

    .doc-card__top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      margin-bottom: 0.25rem;
    }

    .doc-card__name {
      font-size: 0.875rem;
      font-weight: 600;
      color: #111827;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;

      &--hidden {
        text-decoration: line-through;
        color: #9ca3af;
      }
    }

    .doc-card__badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 0.125rem 0.625rem;
      border-radius: 20px;
      font-size: 0.6875rem;
      font-weight: 700;
      white-space: nowrap;
      flex-shrink: 0;

      &--pending { background: #fef3c7; color: #92400e; }
      &--approved { background: #d1fae5; color: #065f46; }
      &--rejected { background: #fee2e2; color: #991b1b; }
    }

    .doc-card__meta {
      font-size: 0.75rem;
      color: #9ca3af;
      display: flex;
      gap: 0.375rem;
    }

    .doc-card__hidden-label {
      font-size: 0.75rem;
      color: #f59e0b;
      font-weight: 600;
      margin: 0.25rem 0 0;
    }

    /* ── Rejected notes ───────────────────────────── */

    .doc-card__reject-notes {
      margin-top: 0.5rem;
    }

    .reject-notes-body {
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
      padding: 0.625rem 0.75rem;
      background: #fef2f2;
      border: 1px solid #fca5a5;
      border-radius: 6px;
    }

    .reject-notes-icon { flex-shrink: 0; margin-top: 1px; }

    .reject-notes-text {
      font-size: 0.8125rem;
      color: #991b1b;
      margin: 0;
      line-height: 1.5;
    }

    /* ── Empty state ──────────────────────────────── */

    .doc-empty {
      text-align: center;
      padding: 1rem;
      font-size: 0.8125rem;
      color: #9ca3af;
    }

    /* ── Buttons ──────────────────────────────────── */

    .btn-ghost {
      padding: 0.375rem 0.875rem;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      background: #fff;
      font-size: 0.8125rem;
      font-weight: 600;
      color: #374151;
      cursor: pointer;
      transition: background 150ms;

      &:hover { background: #f9fafb; }
      &:disabled { opacity: 0.5; cursor: default; }
    }

    .btn-teal {
      padding: 0.375rem 1rem;
      border: none;
      border-radius: 6px;
      background: #2dd4bf;
      color: #fff;
      font-size: 0.8125rem;
      font-weight: 700;
      cursor: pointer;
      transition: box-shadow 150ms;
      box-shadow: 0 1px 3px rgba(45,212,191,0.4);

      &:hover:not(:disabled) { box-shadow: 0 4px 10px rgba(45,212,191,0.5); }
      &:disabled { opacity: 0.5; cursor: default; }
    }

    /* ── Skeleton ─────────────────────────────────── */

    @keyframes shimmer {
      0%   { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    %skeleton {
      background: linear-gradient(90deg, #f1f5f9 25%, #e9edf2 50%, #f1f5f9 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
      border-radius: 6px;
    }

    .loading-row { display: flex; flex-direction: column; gap: 0.75rem; }

    .skeleton-line {
      @extend %skeleton;
      height: 56px;

      &--full { width: 100%; }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentUploadComponent implements OnChanges {

  @Input() residentId: number | null = null;
  @Input() actorId    = 0;
  @Input() actorRole  = 'resident';
  /** When true, hides the upload zone (compliance/read-only view) */
  @Input() readonly   = false;

  @Output() documentUploaded    = new EventEmitter<HpDocument>();
  @Output() consentStatusChanged = new EventEmitter<boolean>();

  // --------------------------------------------------
  // State
  // --------------------------------------------------

  loading        = false;
  documents:     HpDocument[] = [];
  consentGranted = false;

  // Upload flow
  pendingFile:    File | null = null;
  uploading       = false;
  uploadProgress  = 0;
  dragOver        = false;

  // Consent flow
  consentModalOpen = false;

  constructor(
    readonly docService: DocumentService,
    private toast:       ToastService,
    private cdr:         ChangeDetectorRef,
  ) {}

  // --------------------------------------------------
  // Lifecycle
  // --------------------------------------------------

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['residentId'] && this.residentId != null) {
      this.loadDocuments();
    }
  }

  private async loadDocuments(): Promise<void> {
    if (this.residentId == null) return;
    this.loading = true;
    this.cdr.markForCheck();
    try {
      const [docs, consent] = await Promise.all([
        this.docService.getDocuments(this.residentId),
        this.docService.getConsentStatus(this.residentId),
      ]);
      this.documents     = docs;
      this.consentGranted = consent.granted;
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  // --------------------------------------------------
  // Computed
  // --------------------------------------------------

  get atLimit(): boolean {
    return this.documents.length >= this.docService.MAX_FILES_PER_RESIDENT;
  }

  statusClass(doc: HpDocument): string {
    if (doc.hidden) return 'doc-card__badge--pending';
    switch (doc.status) {
      case 'pending_review': return 'doc-card__badge--pending';
      case 'approved':       return 'doc-card__badge--approved';
      case 'rejected':       return 'doc-card__badge--rejected';
      default:               return 'doc-card__badge--pending';
    }
  }

  fileIconBg(mimeType: string): string {
    if (mimeType === 'application/pdf') return '#ef4444';
    if (mimeType === 'image/jpeg')      return '#3b82f6';
    if (mimeType === 'image/png')       return '#10b981';
    return '#6b7280';
  }

  // --------------------------------------------------
  // File selection
  // --------------------------------------------------

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0];
    if (!file) return;
    this.validateAndStagePending(file);
    input.value = ''; // Reset so same file can be re-selected
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver = false;
    const file = event.dataTransfer?.files?.[0];
    if (file) this.validateAndStagePending(file);
  }

  private validateAndStagePending(file: File): void {
    if (!this.docService.ALLOWED_MIME_TYPES.includes(file.type as never)) {
      this.toast.show('Only PDF, JPG, and PNG files are allowed.', 'error');
      return;
    }
    if (file.size > this.docService.MAX_FILE_SIZE_BYTES) {
      this.toast.show(`File exceeds the 10 MB limit (${this.docService.formatSize(file.size)}).`, 'error');
      return;
    }
    this.pendingFile = file;
    this.cdr.markForCheck();
  }

  removePending(): void {
    this.pendingFile = null;
    this.uploadProgress = 0;
    this.cdr.markForCheck();
  }

  // --------------------------------------------------
  // Upload flow (with consent gate)
  // --------------------------------------------------

  startUpload(): void {
    if (!this.pendingFile) return;
    if (!this.consentGranted) {
      // Show consent modal — upload continues in onConsentConfirmed
      this.consentModalOpen = true;
      this.cdr.markForCheck();
      return;
    }
    this.executeUpload();
  }

  async onConsentConfirmed(): Promise<void> {
    this.consentModalOpen = false;
    if (this.residentId == null) return;
    try {
      await this.docService.grantConsent(this.residentId, this.actorId, this.actorRole);
      this.consentGranted = true;
      this.consentStatusChanged.emit(true);
      this.cdr.markForCheck();
      this.executeUpload();
    } catch {
      this.toast.show('Failed to record consent. Please try again.', 'error');
    }
  }

  private async executeUpload(): Promise<void> {
    if (!this.pendingFile || this.residentId == null) return;

    this.uploading      = true;
    this.uploadProgress = 0;
    this.cdr.markForCheck();

    // Simulated progress (1.5s animation) while real upload happens
    const progressInterval = setInterval(() => {
      this.uploadProgress = Math.min(this.uploadProgress + 8, 90);
      this.cdr.markForCheck();
    }, 120);

    try {
      const consent = await this.docService.getConsentStatus(this.residentId);
      if (!consent.granted || !consent.record?.id) {
        throw new Error('CONSENT_REQUIRED');
      }

      const doc = await this.docService.uploadDocument(
        this.residentId,
        this.pendingFile,
        consent.record.id,
        this.actorId,
        this.actorRole,
      );

      clearInterval(progressInterval);
      this.uploadProgress = 100;
      this.cdr.markForCheck();

      await new Promise(r => setTimeout(r, 300));

      this.documents  = [doc, ...this.documents];
      this.pendingFile = null;
      this.uploadProgress = 0;
      this.documentUploaded.emit(doc);
      this.toast.show(`"${doc.fileName}" uploaded successfully.`, 'success');
    } catch (err: unknown) {
      clearInterval(progressInterval);
      this.uploadProgress = 0;
      const msg = err instanceof Error ? err.message : 'Upload failed';
      const friendlyMsg = msg === 'MAX_FILES_REACHED'
        ? 'You have reached the maximum of 5 documents.'
        : msg === 'INVALID_FILE_TYPE'
          ? 'Only PDF, JPG, and PNG files are allowed.'
          : msg === 'FILE_TOO_LARGE'
            ? 'File exceeds the 10 MB limit.'
            : 'Upload failed. Please try again.';
      this.toast.show(friendlyMsg, 'error');
    } finally {
      this.uploading = false;
      this.cdr.markForCheck();
    }
  }

  // --------------------------------------------------
  // Refresh (called by parent after review)
  // --------------------------------------------------

  async refresh(): Promise<void> {
    await this.loadDocuments();
  }
}
