import {
  Component, Input, Output, EventEmitter,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalComponent } from '../../shared/components/modal/modal.component';

// =====================================================
// ConsentModalComponent
// Shown before a resident uploads their first document.
// =====================================================

@Component({
  selector: 'app-consent-modal',
  standalone: true,
  imports: [CommonModule, ModalComponent],
  template: `
    <app-modal
      [open]="open"
      title=""
      size="md"
      type="warning"
      confirmLabel="I Agree & Continue"
      cancelLabel="Cancel"
      (confirmed)="confirmed.emit()"
      (cancelled)="cancelled.emit()"
    >
      <div class="consent-body">

        <!-- Shield icon -->
        <div class="consent-icon-wrap">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L3 6v6c0 5.25 3.75 10.15 9 11.25C17.25 22.15 21 17.25 21 12V6L12 2z"
                  fill="rgba(45,212,191,0.12)" stroke="#2dd4bf" stroke-width="1.75" stroke-linejoin="round"/>
            <path d="M9 12l2 2 4-4" stroke="#2dd4bf" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>

        <h2 class="consent-title">Before You Upload</h2>
        <p class="consent-subtitle">
          Please read how HarborPoint handles your documents.
        </p>

        <!-- Three bullet points -->
        <ul class="consent-list">

          <li class="consent-item">
            <div class="consent-item__icon consent-item__icon--storage">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" stroke-width="2"/>
                <path d="M8 21h8m-4-4v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </div>
            <div>
              <span class="consent-item__label">What is stored</span>
              <p class="consent-item__desc">
                Your file is saved locally on this device. The file hash is encrypted with AES-256.
                No data is transmitted off-site.
              </p>
            </div>
          </li>

          <li class="consent-item">
            <div class="consent-item__icon consent-item__icon--access">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <circle cx="9" cy="7" r="4" stroke="currentColor" stroke-width="2"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87m-4-12a4 4 0 0 1 0 7.75" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </div>
            <div>
              <span class="consent-item__label">Who can see it</span>
              <p class="consent-item__desc">
                Only Compliance Reviewers and Property Administrators can view and review your attachments.
              </p>
            </div>
          </li>

          <li class="consent-item">
            <div class="consent-item__icon consent-item__icon--revoke">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <polyline points="3 6 5 6 21 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M10 11v6m4-6v6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <div>
              <span class="consent-item__label">How to revoke</span>
              <p class="consent-item__desc">
                You can revoke consent at any time in your profile. Documents will be hidden from view;
                audit entries are retained as required.
              </p>
            </div>
          </li>

        </ul>

        <p class="consent-policy-note">
          By continuing you agree to data policy v{{ policyVersion }}.
        </p>

      </div>
    </app-modal>
  `,
  styles: [`
    :host { display: block; }

    .consent-body {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 0.25rem 0 0.5rem;
      text-align: center;
    }

    .consent-icon-wrap {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      background: rgba(45,212,191,0.08);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 1rem;
    }

    .consent-title {
      font-size: 1.375rem;
      font-weight: 800;
      color: #111827;
      margin: 0 0 0.375rem;
    }

    .consent-subtitle {
      font-size: 0.875rem;
      color: #6b7280;
      margin: 0 0 1.25rem;
    }

    .consent-list {
      list-style: none;
      padding: 0;
      margin: 0 0 1rem;
      width: 100%;
      text-align: left;
      display: flex;
      flex-direction: column;
      gap: 0;
    }

    .consent-item {
      display: flex;
      align-items: flex-start;
      gap: 0.875rem;
      padding: 0.875rem 0;
      border-bottom: 1px solid #f3f4f6;

      &:first-child { border-top: 1px solid #f3f4f6; }
    }

    .consent-item__icon {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      margin-top: 1px;

      &--storage { background: rgba(30,58,95,0.08); color: #1e3a5f; }
      &--access  { background: rgba(124,58,237,0.08); color: #7c3aed; }
      &--revoke  { background: rgba(239,68,68,0.08); color: #dc2626; }
    }

    .consent-item__label {
      font-size: 0.875rem;
      font-weight: 700;
      color: #111827;
      display: block;
      margin-bottom: 0.25rem;
    }

    .consent-item__desc {
      font-size: 0.8125rem;
      color: #6b7280;
      margin: 0;
      line-height: 1.5;
    }

    .consent-policy-note {
      font-size: 0.75rem;
      color: #9ca3af;
      margin: 0.5rem 0 0;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConsentModalComponent {

  @Input() open = false;
  @Input() policyVersion = '1.0';

  @Output() confirmed = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();
}
