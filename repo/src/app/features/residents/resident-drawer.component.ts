import {
  Component, Input, Output, EventEmitter,
  OnChanges, SimpleChanges,
  ChangeDetectionStrategy, ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';

import { DrawerComponent } from '../../shared/components/drawer/drawer.component';
import { InputComponent } from '../../shared/components/forms/input.component';
import { SelectComponent, SelectOption } from '../../shared/components/forms/select.component';
import { TextareaComponent } from '../../shared/components/forms/textarea.component';

import { Resident, AuditLog, Occupancy, Room, Unit, Building, ResidentNote } from '../../core/services/db.service';
import { ResidentService, UpdateResidentData } from '../../core/services/resident.service';
import { PropertyService, ReasonCode } from '../../core/services/property.service';
import { DbService } from '../../core/services/db.service';
import { UserRole } from '../../core/services/auth.service';

// =====================================================
// Types
// =====================================================

export interface OccupancyContext {
  occupancy:  Occupancy;
  room:       Room;
  unit:       Unit;
  building:   Building;
}

// =====================================================
// ResidentDrawerComponent
// =====================================================

@Component({
  selector: 'app-resident-drawer',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatTabsModule, MatIconModule, MatButtonModule, MatTooltipModule,
    DrawerComponent, InputComponent, SelectComponent, TextareaComponent,
  ],
  template: `
    <app-drawer
      [open]="open"
      [title]="resident ? (resident.firstName + ' ' + resident.lastName) : 'Resident'"
      [subtitle]="drawerSubtitle"
      (closed)="closed.emit()"
    >
      <!-- ── Loading skeleton ─────────────────────── -->
      <ng-container *ngIf="loading">
        <div class="skeleton-wrap">
          <div class="skeleton-avatar"></div>
          <div class="skeleton-line skeleton-line--title"></div>
          <div class="skeleton-line skeleton-line--sub"></div>
        </div>
      </ng-container>

      <!-- ── Not Found ────────────────────────────── -->
      <ng-container *ngIf="!loading && !resident">
        <div class="not-found">
          <p>Resident not found.</p>
        </div>
      </ng-container>

      <!-- ── Resident content ──────────────────────── -->
      <ng-container *ngIf="!loading && resident">

        <!-- Header -->
        <div class="drawer-header">
          <div
            class="drawer-avatar"
            [style.background]="avatarBg(resident.firstName, resident.lastName)"
          >
            {{ initials(resident) }}
          </div>
          <div class="drawer-header__info">
            <h2 class="drawer-header__name">{{ resident.firstName }} {{ resident.lastName }}</h2>
            <div class="drawer-header__meta">
              <span class="status-chip" [class]="'status-chip--' + resident.status">
                {{ resident.status }}
              </span>
              <span class="room-pill" *ngIf="activeOccCtx">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="9" width="18" height="11" rx="2" stroke="currentColor" stroke-width="2"/>
                  <path d="M9 9V7a3 3 0 0 1 6 0v2" stroke="currentColor" stroke-width="2"/>
                </svg>
                Room {{ activeOccCtx.room.roomNumber }}
              </span>
              <span class="room-pill room-pill--unassigned" *ngIf="!activeOccCtx">
                No room assigned
              </span>
            </div>
          </div>
        </div>

        <!-- Tabs -->
        <mat-tab-group
          class="drawer-tabs"
          animationDuration="150ms"
          [disableRipple]="true"
        >

          <!-- ═══ TAB 1: Profile ═══════════════════════ -->
          <mat-tab label="Profile">
            <div class="tab-content">

              <!-- Edit toggle (admin only) -->
              <div class="tab-actions" *ngIf="canEdit">
                <button
                  *ngIf="!editMode"
                  class="btn-outline"
                  (click)="enterEditMode()"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
                          stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
                          stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  </svg>
                  Edit Profile
                </button>
                <div class="edit-actions" *ngIf="editMode">
                  <button class="btn-ghost" (click)="cancelEdit()" [disabled]="savingProfile">
                    Cancel
                  </button>
                  <button class="btn-teal" (click)="saveProfile()" [disabled]="savingProfile || editForm.invalid">
                    <span *ngIf="!savingProfile">Save Changes</span>
                    <span *ngIf="savingProfile">Saving…</span>
                  </button>
                </div>
              </div>

              <!-- Warning banner (from update warnings) -->
              <div class="warning-banner" *ngIf="profileWarnings.length > 0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" class="warn-icon">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke="#f59e0b" stroke-width="2" stroke-linejoin="round"/>
                  <line x1="12" y1="9" x2="12" y2="13" stroke="#f59e0b" stroke-width="2" stroke-linecap="round"/>
                  <line x1="12" y1="17" x2="12.01" y2="17" stroke="#f59e0b" stroke-width="2" stroke-linecap="round"/>
                </svg>
                <span>{{ profileWarnings[0] }}</span>
              </div>

              <!-- Read-only view -->
              <ng-container *ngIf="!editMode">
                <div class="field-grid">

                  <div class="field-row">
                    <span class="field-label">First Name</span>
                    <span class="field-value">{{ resident.firstName }}</span>
                  </div>

                  <div class="field-row">
                    <span class="field-label">Last Name</span>
                    <span class="field-value">{{ resident.lastName }}</span>
                  </div>

                  <div class="field-row">
                    <span class="field-label">Date of Birth</span>
                    <span class="field-value">{{ resident.dateOfBirth | date:'mediumDate' }}</span>
                  </div>

                  <div class="field-row">
                    <span class="field-label">Status</span>
                    <span class="status-chip" [class]="'status-chip--' + resident.status">{{ resident.status }}</span>
                  </div>

                  <!-- Email — masked by default for admin -->
                  <div class="field-row">
                    <span class="field-label">
                      Email
                      <span class="sensitive-badge" *ngIf="canRevealSensitive">Sensitive</span>
                    </span>
                    <span class="field-value field-value--sensitive">
                      <span *ngIf="!revealEmail">{{ maskedEmail }}</span>
                      <span *ngIf="revealEmail">{{ resident.email }}</span>
                      <button
                        *ngIf="canRevealSensitive"
                        class="reveal-btn"
                        [matTooltip]="revealEmail ? 'Hide' : 'Reveal'"
                        (click)="revealEmail = !revealEmail"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                          <ng-container *ngIf="!revealEmail">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="2"/>
                            <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/>
                          </ng-container>
                          <ng-container *ngIf="revealEmail">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                            <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                          </ng-container>
                        </svg>
                      </button>
                    </span>
                  </div>

                  <!-- Phone — masked by default for admin -->
                  <div class="field-row">
                    <span class="field-label">
                      Phone
                      <span class="sensitive-badge" *ngIf="canRevealSensitive">Sensitive</span>
                    </span>
                    <span class="field-value field-value--sensitive">
                      <span *ngIf="!revealPhone">{{ maskedPhone }}</span>
                      <span *ngIf="revealPhone">{{ resident.phone }}</span>
                      <button
                        *ngIf="canRevealSensitive"
                        class="reveal-btn"
                        [matTooltip]="revealPhone ? 'Hide' : 'Reveal'"
                        (click)="revealPhone = !revealPhone"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                          <ng-container *ngIf="!revealPhone">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="2"/>
                            <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/>
                          </ng-container>
                          <ng-container *ngIf="revealPhone">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                            <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                          </ng-container>
                        </svg>
                      </button>
                    </span>
                  </div>

                  <div class="field-row">
                    <span class="field-label">Member Since</span>
                    <span class="field-value">{{ resident.createdAt | date:'mediumDate' }}</span>
                  </div>

                </div>

                <!-- Notes section -->
                <div class="notes-section">
                  <div class="notes-header">
                    <span class="notes-title">Notes</span>
                    <button class="btn-outline btn-outline--sm" (click)="showAddNote = !showAddNote" *ngIf="canEdit">
                      {{ showAddNote ? 'Cancel' : '+ Add Note' }}
                    </button>
                  </div>

                  <!-- Add note form -->
                  <div class="add-note-form" *ngIf="showAddNote" [formGroup]="noteForm">
                    <app-textarea
                      label="Note text"
                      formControlName="text"
                      placeholder="Enter note…"
                      [rows]="3"
                    ></app-textarea>
                    <label class="checkbox-label">
                      <input type="checkbox" formControlName="confidential" class="checkbox" />
                      <span>Mark as confidential</span>
                    </label>
                    <button
                      class="btn-teal btn-teal--sm"
                      (click)="addNote()"
                      [disabled]="!noteForm.get('text')?.value?.trim()"
                    >Save Note</button>
                  </div>

                  <!-- Notes list -->
                  <div class="notes-list" *ngIf="visibleNotes.length > 0">
                    <div class="note-item" *ngFor="let note of visibleNotes" [class.note-item--confidential]="note.confidential">
                      <div class="note-item__header">
                        <span class="note-item__date">{{ note.createdAt | date:'MMM d, y · h:mm a' }}</span>
                        <span class="note-item__badge" *ngIf="note.confidential">Confidential</span>
                      </div>
                      <p class="note-item__text">{{ note.text }}</p>
                    </div>
                  </div>

                  <p class="notes-empty" *ngIf="visibleNotes.length === 0 && !showAddNote">
                    No notes yet.
                  </p>
                </div>
              </ng-container>

              <!-- Edit form -->
              <ng-container *ngIf="editMode">
                <form [formGroup]="editForm" class="edit-form">
                  <div class="form-row-2">
                    <app-input
                      label="First Name"
                      formControlName="firstName"
                      [required]="true"
                      [errorMessage]="editErr('firstName')"
                    ></app-input>
                    <app-input
                      label="Last Name"
                      formControlName="lastName"
                      [required]="true"
                      [errorMessage]="editErr('lastName')"
                    ></app-input>
                  </div>

                  <app-input
                    label="Email"
                    formControlName="email"
                    type="email"
                    [required]="true"
                    [errorMessage]="editErr('email')"
                  ></app-input>

                  <app-input
                    label="Phone"
                    formControlName="phone"
                    type="tel"
                    [errorMessage]="editErr('phone')"
                  ></app-input>

                  <app-select
                    label="Status"
                    formControlName="status"
                    [required]="true"
                    [options]="statusOptions"
                  ></app-select>
                </form>
              </ng-container>

            </div>
          </mat-tab>

          <!-- ═══ TAB 2: Documents ═══════════════════ -->
          <mat-tab label="Documents">
            <div class="tab-content tab-content--placeholder">
              <div class="placeholder-state">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" class="placeholder-icon">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="#d1d5db" stroke-width="1.5"/>
                  <polyline points="14 2 14 8 20 8" stroke="#d1d5db" stroke-width="1.5"/>
                  <line x1="12" y1="18" x2="12" y2="12" stroke="#d1d5db" stroke-width="1.5" stroke-linecap="round"/>
                  <line x1="9" y1="15" x2="15" y2="15" stroke="#d1d5db" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
                <p class="placeholder-title">Documents</p>
                <p class="placeholder-sub">Available in Phase 5 — Document Management</p>
              </div>
            </div>
          </mat-tab>

          <!-- ═══ TAB 3: Enrollment ══════════════════ -->
          <mat-tab label="Enrollment">
            <div class="tab-content tab-content--placeholder">
              <div class="placeholder-state">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" class="placeholder-icon">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke="#d1d5db" stroke-width="1.5"/>
                  <line x1="16" y1="2" x2="16" y2="6" stroke="#d1d5db" stroke-width="1.5" stroke-linecap="round"/>
                  <line x1="8" y1="2" x2="8" y2="6" stroke="#d1d5db" stroke-width="1.5" stroke-linecap="round"/>
                  <line x1="3" y1="10" x2="21" y2="10" stroke="#d1d5db" stroke-width="1.5"/>
                </svg>
                <p class="placeholder-title">Enrollment</p>
                <p class="placeholder-sub">Available in Phase 8 — Course Registration</p>
              </div>
            </div>
          </mat-tab>

          <!-- ═══ TAB 4: Change Log ══════════════════ -->
          <mat-tab label="Change Log">
            <div class="tab-content">

              <p class="tab-empty" *ngIf="changeLog.length === 0">No changes recorded yet.</p>

              <div class="timeline" *ngIf="changeLog.length > 0">
                <div class="timeline-item" *ngFor="let entry of changeLog">
                  <div class="timeline-dot"></div>
                  <div class="timeline-body">
                    <div class="timeline-header">
                      <span class="timeline-action">{{ formatAction(entry.action) }}</span>
                      <span class="timeline-role">{{ entry.actorRole }}</span>
                    </div>
                    <p class="timeline-date">{{ entry.timestamp | date:'MMM d, y · h:mm a' }}</p>
                    <div class="timeline-diff" *ngIf="entry.before || entry.after">
                      <div class="diff-row" *ngFor="let diff of computeDiff(entry)">
                        <span class="diff-field">{{ diff.field }}</span>
                        <span class="diff-before" *ngIf="diff.before !== undefined">{{ diff.before }}</span>
                        <svg *ngIf="diff.before !== undefined" width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M5 12h14m-7-7 7 7-7 7" stroke="#9ca3af" stroke-width="2" stroke-linecap="round"/></svg>
                        <span class="diff-after">{{ diff.after }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </mat-tab>

          <!-- ═══ TAB 5: Occupancy (admin) ═══════════ -->
          <mat-tab label="Occupancy" *ngIf="canEdit">
            <div class="tab-content">

              <!-- Current occupancy card -->
              <div class="occ-card" *ngIf="activeOccCtx">
                <div class="occ-card__label">Current Assignment</div>
                <div class="occ-card__breadcrumb">
                  <span class="breadcrumb-item">{{ activeOccCtx.building.name }}</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="#9ca3af" stroke-width="2" stroke-linecap="round"/></svg>
                  <span class="breadcrumb-item">Unit {{ activeOccCtx.unit.unitNumber }}</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="#9ca3af" stroke-width="2" stroke-linecap="round"/></svg>
                  <span class="breadcrumb-item breadcrumb-item--room">Room {{ activeOccCtx.room.roomNumber }}</span>
                </div>
                <div class="occ-card__meta">
                  <span>Since {{ activeOccCtx.occupancy.effectiveFrom | date:'mediumDate' }}</span>
                  <span class="occ-chip occ-chip--active">Active</span>
                </div>
                <button class="btn-danger" (click)="moveOutRequested.emit(resident!)">
                  Move Out
                </button>
              </div>

              <div class="occ-unassigned" *ngIf="!activeOccCtx">
                <p class="occ-unassigned__text">This resident has no active room assignment.</p>
                <button class="btn-teal" (click)="moveInRequested.emit(resident!)">
                  Move In
                </button>
              </div>

              <!-- Occupancy history -->
              <div class="occ-history" *ngIf="occupancyHistory.length > 0">
                <div class="occ-history__title">History</div>
                <div class="occ-history-item" *ngFor="let h of occupancyHistory">
                  <div class="occ-history-item__dates">
                    {{ h.effectiveFrom | date:'MMM d, y' }}
                    <span *ngIf="h.effectiveTo"> – {{ h.effectiveTo | date:'MMM d, y' }}</span>
                  </div>
                  <span class="occ-chip" [class]="'occ-chip--' + h.status">{{ h.status }}</span>
                </div>
              </div>

            </div>
          </mat-tab>

        </mat-tab-group>

      </ng-container>
    </app-drawer>
  `,
  styles: [`
    :host { display: block; }

    // ── Header ─────────────────────────────────────

    .drawer-header {
      display: flex;
      align-items: flex-start;
      gap: 1rem;
      padding: 1.25rem 1.5rem 0;
    }

    .drawer-avatar {
      width: 52px;
      height: 52px;
      border-radius: 50%;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.1875rem;
      font-weight: 700;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      flex-shrink: 0;
      box-shadow: 0 2px 6px rgba(0,0,0,0.15);
    }

    .drawer-header__info { flex: 1; min-width: 0; }

    .drawer-header__name {
      font-size: 1.125rem;
      font-weight: 700;
      color: #111827;
      margin: 0 0 0.375rem;
      line-height: 1.2;
    }

    .drawer-header__meta {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    // ── Status / Room chips ─────────────────────────

    .status-chip {
      display: inline-flex;
      align-items: center;
      padding: 0.125rem 0.625rem;
      border-radius: 20px;
      font-size: 0.6875rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;

      &--active   { background: #d1fae5; color: #065f46; }
      &--inactive  { background: #f3f4f6; color: #6b7280; }
      &--pending   { background: #fef3c7; color: #92400e; }
    }

    .room-pill {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 0.125rem 0.5rem;
      background: rgba(30,58,95,0.07);
      color: #1e3a5f;
      border-radius: 20px;
      font-size: 0.75rem;
      font-weight: 600;
    }

    .room-pill--unassigned {
      background: #f9fafb;
      color: #9ca3af;
    }

    // ── Tabs ───────────────────────────────────────

    .drawer-tabs {
      margin-top: 1rem;

      ::ng-deep .mat-mdc-tab-header {
        border-bottom: 1px solid #e5e7eb;
        padding: 0 1.5rem;
      }

      ::ng-deep .mat-mdc-tab-label-container { margin: 0; }

      ::ng-deep .mat-mdc-tab .mdc-tab__text-label {
        font-size: 0.8125rem;
        font-weight: 600;
        color: #6b7280;
      }

      ::ng-deep .mat-mdc-tab.mdc-tab--active .mdc-tab__text-label { color: #1e3a5f; }

      ::ng-deep .mat-mdc-tab-indicator .mdc-tab-indicator__content--underline {
        border-color: #2dd4bf !important;
        border-top-width: 2px !important;
      }
    }

    .tab-content {
      padding: 1.25rem 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .tab-content--placeholder {
      align-items: center;
      padding-top: 3rem;
    }

    // ── Tab actions ────────────────────────────────

    .tab-actions {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 0.25rem;
    }

    .edit-actions {
      display: flex;
      gap: 0.5rem;
    }

    // ── Buttons ────────────────────────────────────

    .btn-outline {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.375rem 0.875rem;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      background: #fff;
      font-size: 0.8125rem;
      font-weight: 600;
      color: #374151;
      cursor: pointer;
      transition: border-color 150ms, background 150ms;

      &:hover { border-color: #1e3a5f; background: #f9fafb; }

      &--sm { padding: 0.25rem 0.625rem; font-size: 0.75rem; }
    }

    .btn-ghost {
      padding: 0.375rem 0.875rem;
      border: none;
      border-radius: 6px;
      background: transparent;
      font-size: 0.8125rem;
      font-weight: 600;
      color: #6b7280;
      cursor: pointer;

      &:hover { background: #f3f4f6; }
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
      box-shadow: 0 1px 3px rgba(45,212,191,0.4);
      transition: box-shadow 150ms, transform 150ms;

      &:hover:not(:disabled) { box-shadow: 0 4px 10px rgba(45,212,191,0.5); transform: translateY(-1px); }
      &:disabled { opacity: 0.5; cursor: default; }

      &--sm { padding: 0.25rem 0.75rem; font-size: 0.75rem; }
    }

    .btn-danger {
      padding: 0.375rem 0.875rem;
      border: 1px solid #fca5a5;
      border-radius: 6px;
      background: #fff;
      color: #dc2626;
      font-size: 0.8125rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 150ms;

      &:hover { background: #fef2f2; }
    }

    // ── Warning banner ─────────────────────────────

    .warning-banner {
      display: flex;
      align-items: flex-start;
      gap: 0.625rem;
      padding: 0.75rem 1rem;
      background: #fffbeb;
      border: 1px solid #fcd34d;
      border-radius: 8px;
      font-size: 0.8125rem;
      color: #92400e;
    }

    .warn-icon { flex-shrink: 0; margin-top: 1px; }

    // ── Field grid (read-only) ──────────────────────

    .field-grid {
      display: flex;
      flex-direction: column;
      gap: 0;
      border: 1px solid #f3f4f6;
      border-radius: 10px;
      overflow: hidden;
    }

    .field-row {
      display: flex;
      align-items: center;
      padding: 0.625rem 1rem;
      border-bottom: 1px solid #f3f4f6;

      &:last-child { border-bottom: none; }
    }

    .field-label {
      width: 130px;
      flex-shrink: 0;
      font-size: 0.8125rem;
      color: #6b7280;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 0.375rem;
    }

    .field-value {
      flex: 1;
      font-size: 0.875rem;
      color: #111827;
      font-weight: 500;

      &--sensitive {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
    }

    .sensitive-badge {
      display: inline-flex;
      padding: 1px 6px;
      background: #fef3c7;
      color: #92400e;
      border-radius: 4px;
      font-size: 0.625rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .reveal-btn {
      padding: 3px;
      border: none;
      background: transparent;
      color: #9ca3af;
      cursor: pointer;
      border-radius: 4px;
      display: flex;
      align-items: center;
      transition: color 150ms;

      &:hover { color: #1e3a5f; }
    }

    // ── Notes ──────────────────────────────────────

    .notes-section {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      padding-top: 0.75rem;
      border-top: 1px solid #f3f4f6;
    }

    .notes-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .notes-title {
      font-size: 0.875rem;
      font-weight: 700;
      color: #374151;
    }

    .add-note-form {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding: 0.75rem;
      background: #f9fafb;
      border-radius: 8px;
    }

    .checkbox-label {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.8125rem;
      color: #374151;
      cursor: pointer;
    }

    .checkbox { width: 14px; height: 14px; accent-color: #1e3a5f; cursor: pointer; }

    .notes-list { display: flex; flex-direction: column; gap: 0.5rem; }

    .note-item {
      padding: 0.75rem;
      background: #f9fafb;
      border-radius: 8px;
      border-left: 3px solid transparent;

      &--confidential { border-left-color: #f59e0b; background: #fffbeb; }
    }

    .note-item__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.25rem;
    }

    .note-item__date {
      font-size: 0.6875rem;
      color: #9ca3af;
      font-weight: 500;
    }

    .note-item__badge {
      padding: 1px 6px;
      background: #fef3c7;
      color: #92400e;
      border-radius: 4px;
      font-size: 0.625rem;
      font-weight: 700;
      text-transform: uppercase;
    }

    .note-item__text {
      font-size: 0.8125rem;
      color: #374151;
      margin: 0;
      line-height: 1.5;
    }

    .notes-empty {
      font-size: 0.8125rem;
      color: #9ca3af;
      margin: 0;
      font-style: italic;
    }

    // ── Edit form ──────────────────────────────────

    .edit-form {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .form-row-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.75rem;
    }

    // ── Timeline (Change Log) ──────────────────────

    .timeline {
      display: flex;
      flex-direction: column;
      gap: 0;
      position: relative;
    }

    .timeline-item {
      display: flex;
      gap: 1rem;
      padding-bottom: 1.25rem;
      position: relative;

      &::before {
        content: '';
        position: absolute;
        left: 7px;
        top: 16px;
        bottom: 0;
        width: 2px;
        background: #e5e7eb;
      }

      &:last-child::before { display: none; }
    }

    .timeline-dot {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: #2dd4bf;
      border: 2px solid #fff;
      box-shadow: 0 0 0 2px #2dd4bf;
      flex-shrink: 0;
      margin-top: 2px;
      z-index: 1;
    }

    .timeline-body { flex: 1; }

    .timeline-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.125rem;
    }

    .timeline-action {
      font-size: 0.875rem;
      font-weight: 700;
      color: #111827;
    }

    .timeline-role {
      padding: 1px 6px;
      background: #f3f4f6;
      color: #6b7280;
      border-radius: 4px;
      font-size: 0.6875rem;
      font-weight: 600;
      text-transform: uppercase;
    }

    .timeline-date {
      font-size: 0.75rem;
      color: #9ca3af;
      margin: 0 0 0.375rem;
    }

    .timeline-diff {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .diff-row {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      font-size: 0.75rem;
    }

    .diff-field {
      color: #6b7280;
      font-weight: 600;
      min-width: 70px;
    }

    .diff-before {
      color: #ef4444;
      text-decoration: line-through;
      opacity: 0.8;
    }

    .diff-after { color: #059669; font-weight: 600; }

    .tab-empty {
      font-size: 0.8125rem;
      color: #9ca3af;
      margin: 0;
      font-style: italic;
    }

    // ── Occupancy tab ──────────────────────────────

    .occ-card {
      padding: 1rem;
      background: #f8faff;
      border: 1px solid #dbe8ff;
      border-radius: 10px;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .occ-card__label {
      font-size: 0.75rem;
      color: #9ca3af;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    .occ-card__breadcrumb {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      flex-wrap: wrap;
    }

    .breadcrumb-item {
      font-size: 0.875rem;
      color: #374151;
      font-weight: 500;

      &--room {
        font-weight: 700;
        color: #1e3a5f;
      }
    }

    .occ-card__meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 0.8125rem;
      color: #6b7280;
    }

    .occ-chip {
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 0.6875rem;
      font-weight: 700;
      text-transform: uppercase;

      &--active  { background: #d1fae5; color: #065f46; }
      &--ended   { background: #f3f4f6; color: #6b7280; }
    }

    .occ-unassigned {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 1rem;
      background: #f9fafb;
      border-radius: 10px;
      border: 1px dashed #e5e7eb;
    }

    .occ-unassigned__text {
      font-size: 0.875rem;
      color: #6b7280;
      margin: 0;
    }

    .occ-history {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .occ-history__title {
      font-size: 0.75rem;
      font-weight: 700;
      color: #9ca3af;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    .occ-history-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.5rem 0.75rem;
      background: #f9fafb;
      border-radius: 6px;
      font-size: 0.8125rem;
    }

    .occ-history-item__dates { color: #374151; }

    // ── Placeholder state ──────────────────────────

    .placeholder-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
      text-align: center;
    }

    .placeholder-icon { opacity: 0.5; }

    .placeholder-title {
      font-size: 1rem;
      font-weight: 700;
      color: #9ca3af;
      margin: 0;
    }

    .placeholder-sub {
      font-size: 0.8125rem;
      color: #d1d5db;
      margin: 0;
    }

    // ── Skeleton ───────────────────────────────────

    .skeleton-wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
      padding: 2rem 1.5rem;
    }

    @keyframes shimmer {
      0%   { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    %skeleton {
      background: linear-gradient(90deg, #f1f5f9 25%, #e9edf2 50%, #f1f5f9 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
      border-radius: 4px;
    }

    .skeleton-avatar {
      @extend %skeleton;
      width: 52px;
      height: 52px;
      border-radius: 50%;
    }

    .skeleton-line {
      @extend %skeleton;
      height: 14px;

      &--title { width: 160px; height: 18px; }
      &--sub   { width: 100px; }
    }

    // ── Not found ─────────────────────────────────

    .not-found {
      padding: 2rem 1.5rem;
      text-align: center;
      color: #9ca3af;
      font-size: 0.875rem;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResidentDrawerComponent implements OnChanges {

  @Input() open        = false;
  @Input() residentId: number | null = null;
  @Input() currentRole: UserRole = 'admin';

  @Output() closed           = new EventEmitter<void>();
  @Output() residentUpdated  = new EventEmitter<Resident>();
  @Output() moveInRequested  = new EventEmitter<Resident>();
  @Output() moveOutRequested = new EventEmitter<Resident>();

  // --------------------------------------------------
  // State
  // --------------------------------------------------

  loading       = false;
  resident:       Resident | null = null;
  changeLog:      AuditLog[] = [];
  activeOccCtx:   OccupancyContext | null = null;
  occupancyHistory: Occupancy[] = [];

  // Profile tab
  editMode        = false;
  savingProfile   = false;
  profileWarnings: string[] = [];
  revealEmail     = false;
  revealPhone     = false;
  showAddNote     = false;

  editForm:   FormGroup;
  noteForm:   FormGroup;

  readonly statusOptions: SelectOption[] = [
    { value: 'active',   label: 'Active' },
    { value: 'pending',  label: 'Pending' },
    { value: 'inactive', label: 'Inactive' },
  ];

  private readonly AVATAR_COLORS = [
    '#1e3a5f', '#0d9488', '#7c3aed', '#db2777',
    '#ea580c', '#16a34a', '#2563eb', '#b45309',
  ];

  constructor(
    private residentService: ResidentService,
    private propertyService: PropertyService,
    private db:              DbService,
    private fb:              FormBuilder,
    private cdr:             ChangeDetectorRef,
  ) {
    this.editForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName:  ['', [Validators.required, Validators.minLength(2)]],
      email:     ['', [Validators.required, Validators.email]],
      phone:     [''],
      status:    ['active', Validators.required],
    });
    this.noteForm = this.fb.group({
      text:         [''],
      confidential: [false],
    });
  }

  // --------------------------------------------------
  // Lifecycle
  // --------------------------------------------------

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['residentId'] || changes['open']) && this.open && this.residentId != null) {
      this.loadData(this.residentId);
    }
    if (changes['open'] && !this.open) {
      this.resetState();
    }
  }

  private async loadData(id: number): Promise<void> {
    this.loading = true;
    this.cdr.markForCheck();

    try {
      const [resident, log, activeOcc] = await Promise.all([
        this.residentService.getResident(id),
        this.residentService.getChangeLog(id),
        this.propertyService.getActiveOccupancy(id),
      ]);

      this.resident  = resident ?? null;
      this.changeLog = log;

      if (activeOcc) {
        const [room, history] = await Promise.all([
          this.db.rooms.get(activeOcc.roomId),
          this.propertyService.getOccupancyHistory(id),
        ]);
        if (room) {
          const unit = await this.db.units.get(room.unitId);
          if (unit) {
            const building = await this.db.buildings.get(unit.buildingId);
            if (building) {
              this.activeOccCtx = { occupancy: activeOcc, room, unit, building };
            }
          }
        }
        this.occupancyHistory = history.filter(h => h.status === 'ended');
      } else {
        this.activeOccCtx = null;
        this.occupancyHistory = await this.propertyService.getOccupancyHistory(id);
      }
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  private resetState(): void {
    this.editMode       = false;
    this.savingProfile  = false;
    this.revealEmail    = false;
    this.revealPhone    = false;
    this.showAddNote    = false;
    this.profileWarnings = [];
  }

  // --------------------------------------------------
  // Computed
  // --------------------------------------------------

  get drawerSubtitle(): string {
    if (!this.resident) return '';
    return this.activeOccCtx
      ? `${this.activeOccCtx.building.name} · Room ${this.activeOccCtx.room.roomNumber}`
      : 'No room assigned';
  }

  get canEdit(): boolean {
    return this.currentRole === 'admin';
  }

  get canRevealSensitive(): boolean {
    return this.currentRole === 'admin' || this.currentRole === 'compliance';
  }

  get maskedEmail(): string {
    if (!this.resident?.email) return '';
    const [local, domain] = this.resident.email.split('@');
    return `${local[0]}***@${domain}`;
  }

  get maskedPhone(): string {
    if (!this.resident?.phone) return '';
    const p = this.resident.phone.replace(/\D/g, '');
    return `***-***-${p.slice(-4)}`;
  }

  get visibleNotes(): ResidentNote[] {
    if (!this.resident?.notes) return [];
    if (this.canEdit) return this.resident.notes;
    return this.resident.notes.filter(n => !n.confidential);
  }

  // --------------------------------------------------
  // Avatar helpers
  // --------------------------------------------------

  initials(r: Resident): string {
    return `${r.firstName[0] ?? ''}${r.lastName[0] ?? ''}`.toUpperCase();
  }

  avatarBg(first: string, last: string): string {
    const name = `${first}${last}`;
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = (hash * 31 + name.charCodeAt(i)) & 0xffffffff;
    }
    return this.AVATAR_COLORS[Math.abs(hash) % this.AVATAR_COLORS.length];
  }

  // --------------------------------------------------
  // Edit mode
  // --------------------------------------------------

  enterEditMode(): void {
    if (!this.resident) return;
    this.editForm.patchValue({
      firstName: this.resident.firstName,
      lastName:  this.resident.lastName,
      email:     this.resident.email,
      phone:     this.resident.phone,
      status:    this.resident.status,
    });
    this.editForm.markAsPristine();
    this.profileWarnings = [];
    this.editMode = true;
  }

  cancelEdit(): void {
    this.editMode = false;
    this.profileWarnings = [];
  }

  async saveProfile(): Promise<void> {
    this.editForm.markAllAsTouched();
    this.cdr.markForCheck();
    if (this.editForm.invalid || !this.resident?.id) return;

    this.savingProfile = true;
    this.cdr.markForCheck();
    try {
      const v = this.editForm.value as UpdateResidentData;
      const { resident, warnings } = await this.residentService.updateResident(
        this.resident.id, v, 0, this.currentRole,
      );
      this.resident       = resident;
      this.profileWarnings = warnings;
      this.editMode        = false;
      this.residentUpdated.emit(resident);
    } finally {
      this.savingProfile = false;
      this.cdr.markForCheck();
    }
  }

  editErr(field: string): string {
    const c = this.editForm.get(field);
    if (!c?.touched || !c.invalid) return '';
    if (c.errors?.['required'])  return 'Required';
    if (c.errors?.['minlength']) return 'Too short';
    if (c.errors?.['email'])     return 'Invalid email';
    return 'Invalid';
  }

  // --------------------------------------------------
  // Notes
  // --------------------------------------------------

  async addNote(): Promise<void> {
    if (!this.resident?.id) return;
    const text         = (this.noteForm.get('text')?.value ?? '').trim();
    const confidential = !!this.noteForm.get('confidential')?.value;
    if (!text) return;

    const newNote: ResidentNote = { text, confidential, createdAt: new Date() };
    const updatedNotes = [...(this.resident.notes ?? []), newNote];

    await this.residentService.updateResident(
      this.resident.id,
      { notes: updatedNotes },
      0, this.currentRole,
    );
    this.resident = { ...this.resident, notes: updatedNotes };
    this.noteForm.reset({ text: '', confidential: false });
    this.showAddNote = false;
    this.cdr.markForCheck();
  }

  // --------------------------------------------------
  // Change log helpers
  // --------------------------------------------------

  formatAction(action: string): string {
    return action.replace(/_/g, ' ').toLowerCase()
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  computeDiff(entry: AuditLog): { field: string; before: unknown; after: unknown }[] {
    if (!entry.after) return [];
    const skipFields = new Set(['updatedAt', 'createdAt', 'encryptedId', 'notes', 'id']);
    const after  = entry.after  as Record<string, unknown>;
    const before = entry.before as Record<string, unknown> | undefined;
    const diffs: { field: string; before: unknown; after: unknown }[] = [];

    for (const key of Object.keys(after)) {
      if (skipFields.has(key)) continue;
      const bVal = before?.[key];
      const aVal = after[key];
      if (JSON.stringify(bVal) !== JSON.stringify(aVal)) {
        diffs.push({ field: key, before: bVal, after: aVal });
      }
    }
    return diffs.slice(0, 4); // limit display rows
  }
}
