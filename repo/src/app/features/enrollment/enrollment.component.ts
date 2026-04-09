import {
  Component, OnInit, OnDestroy,
  ChangeDetectionStrategy, ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSliderModule } from '@angular/material/slider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Subscription } from 'rxjs';

import { DrawerComponent } from '../../shared/components/drawer/drawer.component';
import { ModalComponent } from '../../shared/components/modal/modal.component';
import { ToastService } from '../../shared/components/toast/toast.service';
import { AuthService } from '../../core/services/auth.service';
import { EnrollmentService, CreateCourseParams, CreateRoundParams } from '../../core/services/enrollment.service';
import { Course, CourseRound, Enrollment, EnrollmentHistory, CoursePrerequisite } from '../../core/services/db.service';

// ── Types ──────────────────────────────────────────

interface RoundView extends CourseRound {
  enrolledPct:      number;
  waitlistUsed:     number;
  myEnrollment:     Enrollment | null;
  waitlistPosition: number;
  prereqMet:        boolean;
  prereqReason:     string;
}

const CATEGORIES = ['All', 'Fitness', 'Education', 'Community', 'Wellness'];

const CATEGORY_COLORS: Record<string, string> = {
  Fitness:   'linear-gradient(135deg, #0EA5E9 0%, #2DD4BF 100%)',
  Education: 'linear-gradient(135deg, #1E3A5F 0%, #3B82F6 100%)',
  Community: 'linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)',
  Wellness:  'linear-gradient(135deg, #10B981 0%, #2DD4BF 100%)',
  default:   'linear-gradient(135deg, #1E3A5F 0%, #2DD4BF 100%)',
};

const CATEGORY_ICONS: Record<string, string> = {
  Fitness:   'fitness_center',
  Education: 'school',
  Community: 'people',
  Wellness:  'spa',
  default:   'category',
};

// userId resolved from AuthService session

@Component({
  selector: 'app-enrollment',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule,
    MatIconModule, MatButtonModule, MatTabsModule,
    MatTooltipModule, MatSliderModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    DrawerComponent, ModalComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="enroll-page">

      <!-- ════════════════════════════════════════════
           PAGE HEADER
      ═══════════════════════════════════════════════ -->
      <div class="page-header">
        <div class="page-header__text">
          <h1 class="page-title">Courses &amp; Services</h1>
          <p class="page-subtitle">Register for on-site programs</p>
        </div>
        <div class="page-header__right">
          <span *ngIf="upcomingCount > 0" class="upcoming-badge">
            {{ upcomingCount }} upcoming
          </span>
          <button *ngIf="isAdmin" class="btn-teal" (click)="openCreateCourse()">
            <mat-icon>add</mat-icon>
            New Course
          </button>
        </div>
      </div>

      <!-- ════════════════════════════════════════════
           TABS: Catalog / My Enrollments
      ═══════════════════════════════════════════════ -->
      <mat-tab-group
        class="enroll-tabs"
        animationDuration="150ms"
        (selectedTabChange)="onTabChange($event)"
      >

        <!-- ─── TAB 1: Course Catalog ─────────────── -->
        <mat-tab label="Course Catalog">
          <div class="catalog-wrap">

            <!-- Filter bar + Search -->
            <div class="filter-bar">
              <div class="filter-pills">
                <button
                  *ngFor="let cat of categories"
                  class="filter-pill"
                  [class.filter-pill--active]="activeCategory === cat"
                  (click)="setCategory(cat)"
                >{{ cat }}</button>
              </div>
              <div class="search-wrap">
                <mat-icon class="search-icon-sm">search</mat-icon>
                <input
                  class="search-sm"
                  type="text"
                  placeholder="Search courses…"
                  [(ngModel)]="searchQuery"
                  (input)="filterCourses()"
                />
              </div>
            </div>

            <!-- Loading -->
            <ng-container *ngIf="loading">
              <div class="course-grid">
                <div *ngFor="let _ of [1,2,3,4,5,6]" class="course-card course-card--skeleton">
                  <div class="card-top skeleton-top"></div>
                  <div class="card-body">
                    <div class="skel-line skel-line--title"></div>
                    <div class="skel-line skel-line--desc"></div>
                    <div class="skel-line skel-line--desc"></div>
                  </div>
                </div>
              </div>
            </ng-container>

            <!-- Course grid -->
            <ng-container *ngIf="!loading">
              <div *ngIf="filteredCourses.length === 0" class="empty-state">
                <mat-icon class="empty-icon">school</mat-icon>
                <h3>No courses found</h3>
                <p>{{ searchQuery ? 'Try a different search term.' : 'No courses available yet.' }}</p>
              </div>

              <div class="course-grid" *ngIf="filteredCourses.length > 0">
                <div
                  *ngFor="let course of filteredCourses"
                  class="course-card"
                  (click)="openCourseDetail(course)"
                >
                  <!-- Card top (gradient bg) -->
                  <div
                    class="card-top"
                    [style.background]="getCategoryGradient(course.category)"
                  >
                    <mat-icon class="card-top__icon">{{ getCategoryIcon(course.category) }}</mat-icon>
                    <span class="card-top__label">{{ course.category }}</span>
                  </div>

                  <!-- Card body -->
                  <div class="card-body">
                    <h3 class="card-title">{{ course.title }}</h3>
                    <p class="card-desc">{{ course.description }}</p>

                    <!-- Prerequisites chips -->
                    <div class="prereq-chips" *ngIf="course.prerequisites.length > 0">
                      <ng-container *ngFor="let p of course.prerequisites">
                        <span class="prereq-chip prereq-chip--neutral">
                          {{ prereqLabel(p) }}
                        </span>
                      </ng-container>
                    </div>

                    <!-- Footer -->
                    <div class="card-footer">
                      <div class="card-rounds">
                        <mat-icon class="footer-icon">event</mat-icon>
                        <span>{{ getRoundCount(course.id!) }} round{{ getRoundCount(course.id!) !== 1 ? 's' : '' }}</span>
                      </div>
                      <span
                        *ngIf="getMyStatusForCourse(course.id!)"
                        class="enroll-status-chip"
                        [class]="'enroll-status-chip--' + getMyStatusForCourse(course.id!)"
                      >{{ getMyStatusForCourse(course.id!) }}</span>
                    </div>
                  </div>

                  <!-- View details button -->
                  <button class="btn-view-details" (click)="$event.stopPropagation(); openCourseDetail(course)">
                    View Details
                    <mat-icon>arrow_forward</mat-icon>
                  </button>
                </div>
              </div>
            </ng-container>
          </div>
        </mat-tab>

        <!-- ─── TAB 2: My Enrollments ─────────────── -->
        <mat-tab label="My Enrollments" *ngIf="isResident">
          <div class="my-enrollments-wrap">
            <div *ngIf="myEnrollments.length === 0" class="empty-state">
              <mat-icon class="empty-icon">assignment</mat-icon>
              <h3>No enrollments yet</h3>
              <p>Browse the Course Catalog to register for a program.</p>
            </div>

            <div *ngFor="let e of myEnrollments" class="enroll-row">
              <div class="enroll-row__icon" [class]="'enroll-row__icon--' + e.status">
                <mat-icon>{{ enrollStatusIcon(e.status) }}</mat-icon>
              </div>
              <div class="enroll-row__info">
                <span class="enroll-row__title">{{ getCourseTitle(e.courseId) }}</span>
                <span class="enroll-row__meta">Enrolled {{ e.enrolledAt | date:'mediumDate' }}</span>
              </div>
              <span class="enroll-status-chip" [class]="'enroll-status-chip--' + e.status">
                {{ e.status }}
              </span>
              <button
                *ngIf="e.status === 'enrolled' || e.status === 'waitlisted'"
                class="btn-drop"
                (click)="openDropModal(e)"
              >Drop</button>
            </div>
          </div>
        </mat-tab>

      </mat-tab-group>
    </div>

    <!-- ════════════════════════════════════════════
         COURSE DETAIL DRAWER
    ═══════════════════════════════════════════════ -->
    <app-drawer
      [open]="drawerOpen"
      [title]="selectedCourse?.title ?? ''"
      (closed)="drawerOpen = false"
    >
      <ng-container *ngIf="selectedCourse">

        <!-- Gradient banner -->
        <div
          class="drawer-banner"
          [style.background]="getCategoryGradient(selectedCourse.category)"
        >
          <mat-icon class="banner-icon">{{ getCategoryIcon(selectedCourse.category) }}</mat-icon>
          <span class="banner-label">{{ selectedCourse.category }}</span>
        </div>

        <!-- Description -->
        <div class="drawer-section">
          <p class="drawer-desc">{{ selectedCourse.description }}</p>
        </div>

        <!-- Prerequisites -->
        <div class="drawer-section" *ngIf="selectedCourse.prerequisites.length > 0">
          <h4 class="section-title">Prerequisites</h4>
          <div *ngFor="let p of selectedCourse.prerequisites" class="prereq-row">
            <span class="prereq-row__icon">{{ prereqLabel(p) }}</span>
            <span
              *ngIf="prereqDetails"
              class="prereq-row__status"
              [class]="'prereq-row__status--' + (prereqMetMap[prereqKey(p)] ? 'met' : 'unmet')"
            >
              <mat-icon>{{ prereqMetMap[prereqKey(p)] ? 'check_circle' : 'cancel' }}</mat-icon>
              {{ prereqMetMap[prereqKey(p)] ? 'Eligible' : 'Not eligible' }}
            </span>
          </div>
        </div>

        <!-- Rounds -->
        <div class="drawer-section">
          <div class="section-header">
            <h4 class="section-title">Rounds</h4>
            <button *ngIf="isAdmin" class="btn-link" (click)="openCreateRound()">+ Add Round</button>
          </div>

          <div *ngIf="selectedRounds.length === 0" class="rounds-empty">
            No rounds scheduled yet.
          </div>

          <div *ngFor="let r of selectedRounds" class="round-card">
            <!-- Date + time -->
            <div class="round-card__date">
              <mat-icon class="round-icon">event</mat-icon>
              <div>
                <span class="round-date">{{ r.startAt | date:'EEE, MMM d, y' }}</span>
                <span class="round-time">{{ r.startAt | date:'h:mm a' }} – {{ r.endAt | date:'h:mm a' }}</span>
              </div>
              <span class="duration-chip">{{ durationLabel(r.startAt, r.endAt) }}</span>
              <span class="status-chip-sm" [class]="'status-chip-sm--' + r.status">{{ r.status }}</span>
            </div>

            <!-- Capacity bar -->
            <div class="capacity-wrap">
              <div class="capacity-bar">
                <div
                  class="capacity-bar__fill"
                  [style.width.%]="r.enrolledPct"
                ></div>
              </div>
              <span class="capacity-label">{{ r.enrolled.length }} of {{ r.capacity }} spots</span>
            </div>

            <!-- Waitlist -->
            <div *ngIf="r.waitlisted.length > 0" class="waitlist-row">
              <mat-icon class="wl-icon">schedule</mat-icon>
              <span class="wl-label">{{ r.waitlisted.length }} on waitlist</span>
            </div>

            <!-- Action button -->
            <div class="round-action">

              <!-- Already enrolled -->
              <button
                *ngIf="r.myEnrollment?.status === 'enrolled'"
                class="action-btn action-btn--enrolled"
                disabled
              >
                <mat-icon>check_circle</mat-icon>
                Enrolled
              </button>

              <!-- Already waitlisted -->
              <button
                *ngIf="r.myEnrollment?.status === 'waitlisted'"
                class="action-btn action-btn--waitlisted"
                disabled
              >
                <mat-icon>schedule</mat-icon>
                Waitlisted #{{ r.waitlistPosition }}
              </button>

              <!-- Dropped (can re-enroll if round still open) -->
              <ng-container *ngIf="!r.myEnrollment || r.myEnrollment.status === 'dropped'">

                <button
                  *ngIf="r.status !== 'open'"
                  class="action-btn action-btn--disabled"
                  disabled
                  [matTooltip]="'Round is ' + r.status"
                >
                  <mat-icon>block</mat-icon>
                  {{ r.status | titlecase }}
                </button>

                <ng-container *ngIf="r.status === 'open'">
                  <!-- Enroll now -->
                  <button
                    *ngIf="r.enrolled.length < r.capacity"
                    class="action-btn action-btn--enroll"
                    [disabled]="enrollingRound === r.id || !r.prereqMet"
                    [matTooltip]="!r.prereqMet ? r.prereqReason : ''"
                    (click)="enrollInRound(r)"
                  >
                    <mat-icon>add_circle</mat-icon>
                    Enroll Now
                  </button>

                  <!-- Join waitlist -->
                  <button
                    *ngIf="r.enrolled.length >= r.capacity && r.waitlisted.length < r.waitlistCapacity"
                    class="action-btn action-btn--waitlist"
                    [disabled]="enrollingRound === r.id || !r.prereqMet"
                    [matTooltip]="!r.prereqMet ? r.prereqReason : ''"
                    (click)="joinWaitlist(r)"
                  >
                    <mat-icon>playlist_add</mat-icon>
                    Join Waitlist
                  </button>

                  <!-- Full -->
                  <button
                    *ngIf="r.enrolled.length >= r.capacity && r.waitlisted.length >= r.waitlistCapacity"
                    class="action-btn action-btn--disabled"
                    disabled
                    matTooltip="Class is full"
                  >
                    <mat-icon>do_not_disturb</mat-icon>
                    Full
                  </button>
                </ng-container>
              </ng-container>

              <!-- Drop button (if enrolled/waitlisted) -->
              <button
                *ngIf="r.myEnrollment && (r.myEnrollment.status === 'enrolled' || r.myEnrollment.status === 'waitlisted')"
                class="action-btn action-btn--drop"
                (click)="openDropModal(r.myEnrollment!)"
              >
                Drop
              </button>

            </div>
          </div>
        </div>
      </ng-container>
    </app-drawer>

    <!-- ════════════════════════════════════════════
         ENROLL CONFIRM MODAL
    ═══════════════════════════════════════════════ -->
    <app-modal
      [open]="enrollModalOpen"
      title="Confirm Enrollment"
      confirmLabel="Enroll Now"
      [loading]="enrolling"
      (confirmed)="confirmEnroll()"
      (cancelled)="enrollModalOpen = false"
    >
      <div class="modal-body-inner" *ngIf="pendingRound">
        <div class="confirm-box">
          <mat-icon class="confirm-icon">school</mat-icon>
          <div>
            <p class="confirm-course">{{ selectedCourse?.title }}</p>
            <p class="confirm-date">{{ pendingRound.startAt | date:'EEEE, MMMM d, y' }}</p>
            <p class="confirm-time">{{ pendingRound.startAt | date:'h:mm a' }} – {{ pendingRound.endAt | date:'h:mm a' }}</p>
          </div>
        </div>
        <p class="modal-note">By enrolling, you agree to attend this session. Drops require {{ '2 hours' }} notice before the start time.</p>
      </div>
    </app-modal>

    <!-- ════════════════════════════════════════════
         WAITLIST CONFIRM MODAL
    ═══════════════════════════════════════════════ -->
    <app-modal
      [open]="waitlistModalOpen"
      title="Join Waitlist"
      confirmLabel="Join Waitlist"
      [loading]="enrolling"
      (confirmed)="confirmJoinWaitlist()"
      (cancelled)="waitlistModalOpen = false"
    >
      <div class="modal-body-inner" *ngIf="pendingRound">
        <div class="waitlist-modal-content">
          <div class="wl-position-circle">
            <span>{{ pendingRound.waitlisted.length + 1 }}</span>
          </div>
          <p class="wl-title">You'll be <strong>#{{ pendingRound.waitlisted.length + 1 }}</strong> on the waitlist</p>
          <p class="wl-explain">This class is full. If someone drops, you'll be automatically enrolled (FIFO order).</p>
          <div class="confirm-box confirm-box--sm">
            <p class="confirm-course">{{ selectedCourse?.title }}</p>
            <p class="confirm-date">{{ pendingRound.startAt | date:'EEE, MMM d, y · h:mm a' }}</p>
          </div>
        </div>
      </div>
    </app-modal>

    <!-- ════════════════════════════════════════════
         DROP MODAL
    ═══════════════════════════════════════════════ -->
    <app-modal
      [open]="dropModalOpen"
      [type]="dropBlockedByWindow ? 'warning' : 'danger'"
      [title]="dropBlockedByWindow ? 'Cannot Drop' : 'Drop Enrollment'"
      [confirmLabel]="dropBlockedByWindow ? 'OK' : 'Drop Enrollment'"
      [confirmOnly]="dropBlockedByWindow"
      [loading]="dropping"
      (confirmed)="dropBlockedByWindow ? (dropModalOpen = false) : confirmDrop()"
      (cancelled)="dropModalOpen = false"
    >
      <div class="modal-body-inner" *ngIf="pendingDropEnrollment">
        <div *ngIf="dropBlockedByWindow" class="drop-blocked">
          <mat-icon class="drop-blocked__icon">timer_off</mat-icon>
          <p>Drops are not allowed within <strong>2 hours</strong> of the session start time.</p>
          <p class="drop-blocked__time">Session starts at {{ getDropRoundStart() | date:'h:mm a, MMM d' }}</p>
        </div>
        <div *ngIf="!dropBlockedByWindow" class="drop-confirm">
          <p>Are you sure you want to drop this enrollment?</p>
          <div class="confirm-box confirm-box--danger">
            <p class="confirm-course">{{ getCourseTitle(pendingDropEnrollment.courseId) }}</p>
            <p class="confirm-date">{{ getRoundStartForEnrollment(pendingDropEnrollment) | date:'EEE, MMM d, y · h:mm a' }}</p>
          </div>
          <p class="modal-note warn-note">This action cannot be undone. You may not re-enroll if the class fills up.</p>
        </div>
      </div>
    </app-modal>

    <!-- ════════════════════════════════════════════
         CREATE COURSE MODAL (Admin)
    ═══════════════════════════════════════════════ -->
    <app-modal
      [open]="createCourseOpen"
      title="Create Course"
      size="lg"
      confirmLabel="Create Course"
      [loading]="creatingCourse"
      [confirmDisabled]="!createCourseForm || createCourseForm.invalid"
      (confirmed)="submitCreateCourse()"
      (cancelled)="createCourseOpen = false"
    >
      <form [formGroup]="createCourseForm" class="course-form" *ngIf="createCourseForm">
        <div class="form-grid">
          <mat-form-field appearance="outline">
            <mat-label>Course Title</mat-label>
            <input matInput formControlName="title" placeholder="e.g. Morning Yoga" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Category</mat-label>
            <mat-select formControlName="category">
              <mat-option *ngFor="let c of availableCategories" [value]="c">{{ c }}</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Description</mat-label>
          <textarea matInput formControlName="description" rows="3" placeholder="Describe the course…"></textarea>
        </mat-form-field>

        <!-- Prerequisites builder -->
        <div class="prereq-builder">
          <div class="prereq-builder__header">
            <span class="prereq-builder__label">Prerequisites</span>
            <button type="button" class="btn-link" (click)="addPrereqRow()">+ Add prerequisite</button>
          </div>
          <div formArrayName="prerequisites" class="prereq-rows">
            <div *ngFor="let row of prereqArray.controls; let i = index" [formGroupName]="i" class="prereq-form-row">
              <mat-form-field appearance="outline" class="prereq-type-field">
                <mat-label>Type</mat-label>
                <mat-select formControlName="type">
                  <mat-option value="active_resident">Active Resident</mat-option>
                  <mat-option value="age">Minimum Age</mat-option>
                  <mat-option value="prior_completion">Prior Completion</mat-option>
                </mat-select>
              </mat-form-field>
              <mat-form-field appearance="outline" class="prereq-val-field" *ngIf="row.get('type')?.value === 'age'">
                <mat-label>Min Age</mat-label>
                <input matInput type="number" formControlName="value" min="1" max="120" />
              </mat-form-field>
              <mat-form-field appearance="outline" class="prereq-val-field" *ngIf="row.get('type')?.value === 'prior_completion'">
                <mat-label>Course ID</mat-label>
                <input matInput type="number" formControlName="value" />
              </mat-form-field>
              <button type="button" class="btn-remove" (click)="removePrereqRow(i)">
                <mat-icon>close</mat-icon>
              </button>
            </div>
          </div>
        </div>
      </form>
    </app-modal>

    <!-- ════════════════════════════════════════════
         CREATE ROUND MODAL (Admin)
    ═══════════════════════════════════════════════ -->
    <app-modal
      [open]="createRoundOpen"
      title="Schedule Round"
      size="lg"
      confirmLabel="Schedule Round"
      [loading]="creatingRound"
      [confirmDisabled]="!createRoundForm || createRoundForm.invalid"
      (confirmed)="submitCreateRound()"
      (cancelled)="createRoundOpen = false"
    >
      <form [formGroup]="createRoundForm" class="round-form" *ngIf="createRoundForm">
        <div class="form-grid">
          <mat-form-field appearance="outline">
            <mat-label>Start Date &amp; Time</mat-label>
            <input matInput type="datetime-local" formControlName="startAt" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>End Date &amp; Time</mat-label>
            <input matInput type="datetime-local" formControlName="endAt" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Capacity</mat-label>
            <input matInput type="number" formControlName="capacity" min="1" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Waitlist Capacity</mat-label>
            <input matInput type="number" formControlName="waitlistCapacity" min="0" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Add Cutoff</mat-label>
            <input matInput type="datetime-local" formControlName="addCutoffAt" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Drop Cutoff (auto: 2h before start)</mat-label>
            <input matInput type="datetime-local" formControlName="dropCutoffAt" />
          </mat-form-field>
        </div>
      </form>
    </app-modal>
  `,
  styleUrls: ['./enrollment.component.scss'],
})
export class EnrollmentComponent implements OnInit, OnDestroy {

  // ── Data ───────────────────────────────────────
  courses:         Course[]    = [];
  filteredCourses: Course[]    = [];
  myEnrollments:   Enrollment[] = [];
  roundsByCoursId: Map<number, CourseRound[]> = new Map();
  courseMap:       Map<number, Course>        = new Map();

  // ── UI state ───────────────────────────────────
  loading         = true;
  activeCategory  = 'All';
  searchQuery     = '';
  categories      = CATEGORIES;

  // ── Drawer ─────────────────────────────────────
  drawerOpen      = false;
  selectedCourse: Course | null     = null;
  selectedRounds: RoundView[]       = [];
  prereqDetails   = false;
  prereqMetMap:   Record<string, boolean> = {};

  // ── Modals ─────────────────────────────────────
  enrollModalOpen     = false;
  waitlistModalOpen   = false;
  dropModalOpen       = false;
  createCourseOpen    = false;
  createRoundOpen     = false;

  enrolling      = false;
  dropping       = false;
  creatingCourse = false;
  creatingRound  = false;
  enrollingRound: number | null = null;

  pendingRound:          RoundView | null = null;
  pendingAction:         'enroll' | 'waitlist' = 'enroll';
  pendingDropEnrollment: Enrollment | null = null;
  dropBlockedByWindow   = false;

  // ── Forms ──────────────────────────────────────
  createCourseForm!: FormGroup;
  createRoundForm!:  FormGroup;
  availableCategories = ['Fitness', 'Education', 'Community', 'Wellness', 'Other'];

  private subs: Subscription[] = [];

  get isAdmin():    boolean { return this.auth.hasRole('admin'); }
  get isResident(): boolean { return this.auth.hasRole('resident'); }
  get currentUserId(): number { return this.auth.getCurrentUserId() ?? 0; }
  get upcomingCount(): number {
    const now = new Date();
    let count = 0;
    this.roundsByCoursId.forEach(rounds => {
      count += rounds.filter(r => r.startAt > now && r.status === 'open').length;
    });
    return count;
  }

  get prereqArray(): FormArray {
    return this.createCourseForm?.get('prerequisites') as FormArray;
  }

  constructor(
    private enrollSvc: EnrollmentService,
    private auth:      AuthService,
    private toast:     ToastService,
    private fb:        FormBuilder,
    private cdr:       ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  // ── Data loading ───────────────────────────────

  async loadData(): Promise<void> {
    this.loading = true;
    this.cdr.markForCheck();
    try {
      const [courses, rounds] = await Promise.all([
        this.enrollSvc.getCourses(),
        this.loadAllRounds(),
      ]);
      this.courses = courses;
      this.courseMap.clear();
      for (const c of courses) {
        if (c.id != null) this.courseMap.set(c.id, c);
      }
      this.roundsByCoursId = rounds;

      if (this.isResident) {
        this.myEnrollments = await this.enrollSvc.getEnrollmentsForResident(this.currentUserId);
      }

      this.filterCourses();
    } catch {
      this.toast.error('Failed to load courses.');
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  private async loadAllRounds(): Promise<Map<number, CourseRound[]>> {
    const courses = await this.enrollSvc.getCourses();
    const map     = new Map<number, CourseRound[]>();
    await Promise.all(courses.map(async c => {
      if (c.id != null) {
        map.set(c.id, await this.enrollSvc.getCourseRounds(c.id));
      }
    }));
    return map;
  }

  // ── Filters ────────────────────────────────────

  setCategory(cat: string): void {
    this.activeCategory = cat;
    this.filterCourses();
  }

  filterCourses(): void {
    let result = this.courses;
    if (this.activeCategory !== 'All') {
      result = result.filter(c => c.category === this.activeCategory);
    }
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      result = result.filter(c =>
        c.title.toLowerCase().includes(q) || c.description.toLowerCase().includes(q),
      );
    }
    this.filteredCourses = result;
    this.cdr.markForCheck();
  }

  onTabChange(e: { index: number }): void {
    if (e.index === 1 && this.isResident) {
      this.enrollSvc.getEnrollmentsForResident(this.currentUserId)
        .then(r => { this.myEnrollments = r; this.cdr.markForCheck(); });
    }
  }

  // ── Course detail drawer ───────────────────────

  async openCourseDetail(course: Course): Promise<void> {
    this.selectedCourse = course;
    this.drawerOpen     = true;
    this.prereqDetails  = false;
    this.prereqMetMap   = {};
    this.cdr.markForCheck();

    try {
      const rounds = await this.enrollSvc.getCourseRounds(course.id!);
      this.roundsByCoursId.set(course.id!, rounds);

      // Get prereq check for current user (resident)
      let prereqReason = '';
      if (course.id != null) {
        const prereqResult = await this.enrollSvc.checkPrerequisites(this.currentUserId, course.id);
        this.prereqDetails = true;
        prereqReason = prereqResult.reason ?? '';
        for (const d of (prereqResult.details ?? [])) {
          this.prereqMetMap[this.prereqKey(d.prereq)] = d.met;
        }
      }

      const myEnrollments = this.isResident
        ? await this.enrollSvc.getEnrollmentsForResident(this.currentUserId)
        : [];

      this.selectedRounds = rounds.map(r => {
        const myE = myEnrollments.find(e => e.roundId === r.id && e.status !== 'dropped') ?? null;
        const wlPos = myE?.status === 'waitlisted'
          ? (r.waitlisted.indexOf(this.currentUserId) + 1)
          : 0;
        return {
          ...r,
          enrolledPct:      r.capacity > 0 ? Math.min((r.enrolled.length / r.capacity) * 100, 100) : 0,
          waitlistUsed:     r.waitlisted.length,
          myEnrollment:     myE,
          waitlistPosition: wlPos,
          prereqMet:        Object.values(this.prereqMetMap).every(v => v),
          prereqReason,
        };
      }).sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

    } catch {
      this.toast.error('Failed to load course details.');
    }
    this.cdr.markForCheck();
  }

  // ── Enroll / Waitlist actions ──────────────────

  enrollInRound(round: RoundView): void {
    this.pendingRound     = round;
    this.pendingAction    = 'enroll';
    this.enrollModalOpen  = true;
  }

  joinWaitlist(round: RoundView): void {
    this.pendingRound       = round;
    this.pendingAction      = 'waitlist';
    this.waitlistModalOpen  = true;
  }

  async confirmEnroll(): Promise<void> {
    if (!this.pendingRound || !this.selectedCourse) return;
    this.enrolling      = true;
    this.enrollingRound = this.pendingRound.id ?? null;
    this.cdr.markForCheck();

    try {
      const result = await this.enrollSvc.enroll(
        this.currentUserId, this.pendingRound.id!,
      );
      if (result.success) {
        this.toast.success(`Successfully enrolled in ${this.selectedCourse.title}!`);
        this.enrollModalOpen = false;
        await this.openCourseDetail(this.selectedCourse);
        await this.loadData();
      } else {
        this.toast.error(`Enrollment failed: ${result.reason}`);
        this.enrollModalOpen = false;
      }
    } finally {
      this.enrolling      = false;
      this.enrollingRound = null;
      this.cdr.markForCheck();
    }
  }

  async confirmJoinWaitlist(): Promise<void> {
    if (!this.pendingRound || !this.selectedCourse) return;
    this.enrolling = true;
    this.cdr.markForCheck();

    try {
      const result = await this.enrollSvc.enroll(
        this.currentUserId, this.pendingRound.id!,
      );
      if (result.success && result.status === 'waitlisted') {
        this.toast.success(`You've joined the waitlist for ${this.selectedCourse.title}.`);
        this.waitlistModalOpen = false;
        await this.openCourseDetail(this.selectedCourse);
        await this.loadData();
      } else if (!result.success) {
        this.toast.error(`Failed to join waitlist: ${result.reason}`);
        this.waitlistModalOpen = false;
      }
    } finally {
      this.enrolling = false;
      this.cdr.markForCheck();
    }
  }

  // ── Drop ───────────────────────────────────────

  async openDropModal(enrollment: Enrollment): Promise<void> {
    this.pendingDropEnrollment = enrollment;
    const round = await this.enrollSvc.getCourseRounds(enrollment.courseId)
      .then(rounds => rounds.find(r => r.id === enrollment.roundId));
    const now = new Date();
    this.dropBlockedByWindow = round ? now > round.dropCutoffAt : false;
    this.dropModalOpen       = true;
    this.cdr.markForCheck();
  }

  async confirmDrop(): Promise<void> {
    if (!this.pendingDropEnrollment) return;
    this.dropping = true;
    this.cdr.markForCheck();

    try {
      const result = await this.enrollSvc.drop(
        this.pendingDropEnrollment.id!,
        'VOLUNTARY_DEPARTURE',
      );
      if (result.success) {
        this.toast.success('Enrollment dropped.');
        this.dropModalOpen = false;
        if (this.selectedCourse) await this.openCourseDetail(this.selectedCourse);
        await this.loadData();
      } else {
        this.toast.error(`Drop failed: ${result.reason}`);
        this.dropModalOpen = false;
      }
    } finally {
      this.dropping = false;
      this.cdr.markForCheck();
    }
  }

  // ── Admin: Create Course ───────────────────────

  openCreateCourse(): void {
    this.createCourseForm = this.fb.group({
      title:         ['', Validators.required],
      description:   ['', Validators.required],
      category:      ['Education', Validators.required],
      prerequisites: this.fb.array([]),
    });
    this.createCourseOpen = true;
  }

  addPrereqRow(): void {
    this.prereqArray.push(this.fb.group({
      type:  ['active_resident'],
      value: [null],
    }));
  }

  removePrereqRow(i: number): void {
    this.prereqArray.removeAt(i);
  }

  async submitCreateCourse(): Promise<void> {
    if (this.createCourseForm.invalid) return;
    this.creatingCourse = true;
    this.cdr.markForCheck();

    const v = this.createCourseForm.value;
    const prereqs: import('../../core/services/db.service').CoursePrerequisite[] = (v.prerequisites ?? []).map(
      (p: { type: string; value: unknown }) => ({ type: p.type as 'age' | 'active_resident' | 'prior_completion', value: p.value }),
    );

    try {
      await this.enrollSvc.createCourse({ title: v.title, description: v.description, category: v.category, prerequisites: prereqs });
      this.toast.success('Course created.');
      this.createCourseOpen = false;
      await this.loadData();
    } catch {
      this.toast.error('Failed to create course.');
    } finally {
      this.creatingCourse = false;
      this.cdr.markForCheck();
    }
  }

  // ── Admin: Create Round ────────────────────────

  openCreateRound(): void {
    if (!this.selectedCourse) return;
    const now      = new Date();
    const start    = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
    const end      = new Date(start.getTime() + 3600 * 1000);
    const addCutoff  = new Date(start.getTime() - 3600 * 1000);
    const dropCutoff = new Date(start.getTime() - 2 * 3600 * 1000);

    this.createRoundForm = this.fb.group({
      startAt:         [this.toDatetimeLocal(start), Validators.required],
      endAt:           [this.toDatetimeLocal(end),   Validators.required],
      capacity:        [20, [Validators.required, Validators.min(1)]],
      waitlistCapacity:[10, [Validators.required, Validators.min(0)]],
      addCutoffAt:     [this.toDatetimeLocal(addCutoff),  Validators.required],
      dropCutoffAt:    [this.toDatetimeLocal(dropCutoff), Validators.required],
    });
    this.createRoundOpen = true;
  }

  async submitCreateRound(): Promise<void> {
    if (!this.selectedCourse || this.createRoundForm.invalid) return;
    this.creatingRound = true;
    this.cdr.markForCheck();

    const v = this.createRoundForm.value;
    try {
      await this.enrollSvc.createRound({
        courseId:         this.selectedCourse.id!,
        startAt:          new Date(v.startAt),
        endAt:            new Date(v.endAt),
        capacity:         +v.capacity,
        waitlistCapacity: +v.waitlistCapacity,
        addCutoffAt:      new Date(v.addCutoffAt),
        dropCutoffAt:     new Date(v.dropCutoffAt),
      });
      this.toast.success('Round scheduled.');
      this.createRoundOpen = false;
      await this.openCourseDetail(this.selectedCourse);
    } catch {
      this.toast.error('Failed to create round.');
    } finally {
      this.creatingRound = false;
      this.cdr.markForCheck();
    }
  }

  // ── Template helpers ───────────────────────────

  getCategoryGradient(cat: string): string {
    return CATEGORY_COLORS[cat] ?? CATEGORY_COLORS['default'];
  }
  getCategoryIcon(cat: string): string {
    return CATEGORY_ICONS[cat] ?? CATEGORY_ICONS['default'];
  }

  prereqLabel(p: CoursePrerequisite): string {
    if (p.type === 'active_resident') return '✅ Active Resident';
    if (p.type === 'age')             return `🔞 Age ${p.value}+`;
    if (p.type === 'prior_completion') return `📚 Prior Course #${p.value}`;
    return p.type;
  }

  prereqKey(p: CoursePrerequisite): string {
    return `${p.type}-${p.value}`;
  }

  getRoundCount(courseId: number): number {
    return this.roundsByCoursId.get(courseId)?.length ?? 0;
  }

  getMyStatusForCourse(courseId: number): string | null {
    const e = this.myEnrollments.find(e => e.courseId === courseId && e.status !== 'dropped');
    return e?.status ?? null;
  }

  getCourseTitle(courseId: number): string {
    return this.courseMap.get(courseId)?.title ?? 'Course';
  }

  enrollStatusIcon(status: string): string {
    const icons: Record<string, string> = {
      enrolled: 'check_circle', waitlisted: 'schedule',
      dropped: 'cancel', completed: 'done_all',
    };
    return icons[status] ?? 'circle';
  }

  durationLabel(start: Date, end: Date): string {
    const mins = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60); const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }

  getRoundStartForEnrollment(e: Enrollment): Date | null {
    const rounds = this.roundsByCoursId.get(e.courseId) ?? [];
    return rounds.find(r => r.id === e.roundId)?.startAt ?? null;
  }

  getDropRoundStart(): Date | null {
    if (!this.pendingDropEnrollment) return null;
    return this.getRoundStartForEnrollment(this.pendingDropEnrollment);
  }

  private toDatetimeLocal(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
}
