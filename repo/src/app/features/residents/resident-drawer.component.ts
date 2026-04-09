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
import { DocumentUploadComponent } from '../documents/document-upload.component';

import { Resident, AuditLog, Occupancy, Room, Unit, Building, ResidentNote, Enrollment, EnrollmentHistory } from '../../core/services/db.service';
import { ResidentService, UpdateResidentData } from '../../core/services/resident.service';
import { PropertyService, ReasonCode } from '../../core/services/property.service';
import { DbService } from '../../core/services/db.service';
import { UserRole } from '../../core/services/auth.service';
import { EnrollmentService } from '../../core/services/enrollment.service';

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
    DocumentUploadComponent,
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
            <div class="tab-content">
              <app-document-upload
                [residentId]="residentId"
                [readonly]="!canEdit"
              ></app-document-upload>
            </div>
          </mat-tab>

          <!-- ═══ TAB 3: Enrollment ══════════════════ -->
          <mat-tab label="Enrollment">
            <div class="tab-content">

              <!-- Empty state -->
              <ng-container *ngIf="enrollments.length === 0">
                <div class="placeholder-state" style="padding-top:2rem">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" class="placeholder-icon">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke="#d1d5db" stroke-width="1.5"/>
                    <line x1="16" y1="2" x2="16" y2="6" stroke="#d1d5db" stroke-width="1.5" stroke-linecap="round"/>
                    <line x1="8" y1="2" x2="8" y2="6" stroke="#d1d5db" stroke-width="1.5" stroke-linecap="round"/>
                    <line x1="3" y1="10" x2="21" y2="10" stroke="#d1d5db" stroke-width="1.5"/>
                  </svg>
                  <p class="placeholder-title">No Enrollments</p>
                  <p class="placeholder-sub">This resident has no course enrollments yet.</p>
                </div>
              </ng-container>

              <!-- Enrollment timeline -->
              <ng-container *ngIf="enrollments.length > 0">
                <div class="enroll-list">
                  <div class="enroll-card" *ngFor="let enroll of enrollments">

                    <!-- Card header -->
                    <div class="enroll-card__header">
                      <span class="enroll-status-badge enroll-status-badge--{{ enroll.status }}">
                        {{ enroll.status | titlecase }}
                      </span>
                      <span class="enroll-meta">Course #{{ enroll.courseId }} · Round #{{ enroll.roundId }}</span>
                    </div>

                    <!-- Vertical timeline -->
                    <div class="enroll-timeline" *ngIf="enrollmentHistories.get(enroll.id!) as history">
                      <div class="enroll-timeline__item" *ngFor="let entry of history; let last = last">
                        <div class="enroll-timeline__track">
                          <div class="enroll-timeline__node"></div>
                          <div class="enroll-timeline__line" *ngIf="!last"></div>
                        </div>
                        <div class="enroll-timeline__body">
                          <span class="enroll-action-chip enroll-action-chip--{{ entry.status }}">
                            {{ entry.status | titlecase }}
                            <ng-container *ngIf="entry.reason"> · {{ entry.reason }}</ng-container>
                          </span>
                          <span class="enroll-time">{{ entry.changedAt | date:'MMM d, y, h:mm a' }}</span>
                          <span class="enroll-actor" *ngIf="entry.changedBy === 0">System</span>
                          <span class="enroll-actor" *ngIf="entry.changedBy === resident?.id">You</span>
                          <span class="enroll-actor" *ngIf="entry.changedBy !== 0 && entry.changedBy !== resident?.id">Admin</span>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              </ng-container>

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
  styleUrls: ['./resident-drawer.component.scss'],
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

  // Enrollment tab
  enrollments:    Enrollment[] = [];
  enrollmentHistories: Map<number, EnrollmentHistory[]> = new Map();

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
    private residentService:  ResidentService,
    private propertyService:  PropertyService,
    private db:               DbService,
    private enrollmentService: EnrollmentService,
    private fb:               FormBuilder,
    private cdr:              ChangeDetectorRef,
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
      const [resident, log, activeOcc, enrollments] = await Promise.all([
        this.residentService.getResident(id),
        this.residentService.getChangeLog(id),
        this.propertyService.getActiveOccupancy(id),
        this.enrollmentService.getEnrollmentsForResident(id),
      ]);

      this.resident  = resident ?? null;
      this.changeLog = log;
      this.enrollments = enrollments;

      // Load history snapshots for each enrollment
      const histMap = new Map<number, EnrollmentHistory[]>();
      await Promise.all(enrollments.map(async e => {
        if (e.id != null) {
          histMap.set(e.id, e.historySnapshot ?? []);
        }
      }));
      this.enrollmentHistories = histMap;

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
    this.enrollments     = [];
    this.enrollmentHistories = new Map();
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
        this.resident.id, v,
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
