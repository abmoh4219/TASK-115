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

// Role-to-userId mapping (demo)
const ROLE_USER_ID: Record<string, number> = {
  admin: 1, resident: 2, compliance: 3, analyst: 4,
};

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
  styles: [`
    /* ── Page shell ─────────────────────────────── */
    .enroll-page {
      padding: 1.5rem 2rem;
      max-width: 1400px;
      margin: 0 auto;
    }

    /* ── Page header ────────────────────────────── */
    .page-header {
      display: flex; align-items: flex-start; justify-content: space-between;
      margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;
    }
    .page-title {
      font-size: 1.75rem; font-weight: 800; color: var(--hp-navy, #1E3A5F); margin: 0 0 0.25rem;
    }
    .page-subtitle { color: #64748B; margin: 0; font-size: 0.95rem; }
    .page-header__right { display: flex; align-items: center; gap: 0.75rem; }
    .upcoming-badge {
      background: rgba(45,212,191,0.12); color: var(--hp-teal, #2DD4BF);
      font-size: 0.8rem; font-weight: 700;
      border-radius: 20px; padding: 4px 12px;
    }
    .btn-teal {
      display: inline-flex; align-items: center; gap: 0.4rem;
      background: var(--hp-teal, #2DD4BF); color: #fff;
      border: none; border-radius: 8px; padding: 8px 16px;
      font-size: 0.875rem; font-weight: 600; cursor: pointer;
      transition: background 150ms;
    }
    .btn-teal:hover { background: #14b8a6; }

    /* ── Tabs ───────────────────────────────────── */
    ::ng-deep .enroll-tabs .mat-mdc-tab-header { border-bottom: 1px solid var(--hp-border, #E2E8F0); }

    /* ── Filter bar ─────────────────────────────── */
    .catalog-wrap { padding-top: 1.25rem; }
    .filter-bar {
      display: flex; align-items: center; justify-content: space-between;
      flex-wrap: wrap; gap: 0.75rem; margin-bottom: 1.5rem;
    }
    .filter-pills { display: flex; gap: 0.5rem; flex-wrap: wrap; }
    .filter-pill {
      background: #F1F5F9; color: #475569; border: none;
      border-radius: 20px; padding: 6px 16px;
      font-size: 0.8rem; font-weight: 600; cursor: pointer;
      transition: background 150ms, color 150ms;
    }
    .filter-pill--active { background: var(--hp-teal, #2DD4BF); color: #fff; }
    .filter-pill:not(.filter-pill--active):hover { background: #E2E8F0; }

    .search-wrap {
      display: flex; align-items: center; gap: 0.5rem;
      background: #fff; border: 1px solid var(--hp-border, #E2E8F0);
      border-radius: 10px; padding: 0 0.75rem; height: 40px;
    }
    .search-icon-sm { color: #94A3B8; font-size: 18px; width: 18px; height: 18px; }
    .search-sm { border: none; outline: none; font-size: 0.875rem; background: transparent; width: 200px; }

    /* ── Course grid ────────────────────────────── */
    .course-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1.25rem;
    }
    @media (max-width: 1200px) { .course-grid { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 768px)  { .course-grid { grid-template-columns: 1fr; } }

    /* Course card */
    .course-card {
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.07);
      overflow: hidden;
      display: flex; flex-direction: column;
      cursor: pointer;
      transition: transform 200ms ease, box-shadow 200ms ease;
    }
    .course-card:hover {
      transform: translateY(-3px);
      box-shadow: 0 8px 24px rgba(0,0,0,0.1);
    }

    .card-top {
      height: 100px;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      gap: 0.4rem; position: relative;
    }
    .card-top__icon { color: rgba(255,255,255,0.9); font-size: 2rem; width: 2rem; height: 2rem; }
    .card-top__label {
      color: rgba(255,255,255,0.85);
      font-size: 0.7rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
    }

    .card-body { padding: 1rem 1.25rem; flex: 1; display: flex; flex-direction: column; gap: 0.5rem; }
    .card-title { font-size: 1.05rem; font-weight: 700; color: var(--hp-navy, #1E3A5F); margin: 0; }
    .card-desc {
      font-size: 0.825rem; color: #64748B; margin: 0;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
    }

    .prereq-chips { display: flex; flex-wrap: wrap; gap: 0.3rem; }
    .prereq-chip {
      font-size: 0.7rem; border-radius: 12px; padding: 2px 8px; font-weight: 500;
    }
    .prereq-chip--neutral { background: #F1F5F9; color: #475569; }
    .prereq-chip--met    { background: rgba(16,185,129,0.1); color: #059669; }
    .prereq-chip--unmet  { background: rgba(239,68,68,0.1); color: #DC2626; }

    .card-footer {
      display: flex; align-items: center; justify-content: space-between;
      margin-top: auto; padding-top: 0.5rem;
    }
    .card-rounds { display: flex; align-items: center; gap: 0.25rem; color: #64748B; font-size: 0.8rem; }
    .footer-icon { font-size: 14px; width: 14px; height: 14px; }

    .enroll-status-chip {
      font-size: 0.7rem; font-weight: 700; border-radius: 12px; padding: 2px 10px; text-transform: capitalize;
    }
    .enroll-status-chip--enrolled   { background: rgba(16,185,129,0.12); color: #059669; }
    .enroll-status-chip--waitlisted { background: rgba(245,158,11,0.12); color: #D97706; }
    .enroll-status-chip--dropped    { background: rgba(239,68,68,0.1); color: #DC2626; }
    .enroll-status-chip--completed  { background: rgba(30,58,95,0.08); color: var(--hp-navy, #1E3A5F); }

    .btn-view-details {
      display: flex; align-items: center; justify-content: center; gap: 0.4rem;
      width: 100%; border: 2px solid var(--hp-teal, #2DD4BF); background: transparent;
      color: var(--hp-teal, #2DD4BF); padding: 10px;
      font-size: 0.875rem; font-weight: 600; cursor: pointer;
      transition: background 150ms, color 150ms;
    }
    .btn-view-details:hover { background: var(--hp-teal, #2DD4BF); color: #fff; }

    /* Skeleton */
    .course-card--skeleton { cursor: default; pointer-events: none; }
    .skeleton-top {
      height: 100px;
      background: linear-gradient(90deg, #F1F5F9 25%, #E2E8F0 50%, #F1F5F9 75%);
      background-size: 200% 100%;
      animation: shimmer 1.4s infinite;
    }
    .skel-line {
      border-radius: 6px;
      background: linear-gradient(90deg, #F1F5F9 25%, #E2E8F0 50%, #F1F5F9 75%);
      background-size: 200% 100%;
      animation: shimmer 1.4s infinite;
      margin-bottom: 0.5rem;
    }
    .skel-line--title { height: 18px; width: 70%; }
    .skel-line--desc  { height: 13px; width: 90%; }
    @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

    /* ── My Enrollments ─────────────────────────── */
    .my-enrollments-wrap { padding-top: 1.25rem; display: flex; flex-direction: column; gap: 0.75rem; }
    .enroll-row {
      display: flex; align-items: center; gap: 1rem;
      background: #fff; border-radius: 12px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.06);
      padding: 0.875rem 1.25rem;
    }
    .enroll-row__icon {
      width: 40px; height: 40px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .enroll-row__icon--enrolled   { background: rgba(16,185,129,0.12); color: #059669; }
    .enroll-row__icon--waitlisted { background: rgba(245,158,11,0.12); color: #D97706; }
    .enroll-row__icon--dropped    { background: rgba(239,68,68,0.1); color: #DC2626; }
    .enroll-row__icon--completed  { background: rgba(30,58,95,0.08); color: var(--hp-navy, #1E3A5F); }
    .enroll-row__info { flex: 1; display: flex; flex-direction: column; gap: 0.15rem; min-width: 0; }
    .enroll-row__title { font-weight: 600; color: var(--hp-navy, #1E3A5F); font-size: 0.95rem; }
    .enroll-row__meta  { font-size: 0.78rem; color: #94A3B8; }
    .btn-drop {
      background: none; border: 1px solid #EF4444; color: #EF4444;
      border-radius: 6px; padding: 4px 12px; font-size: 0.8rem; cursor: pointer;
      transition: background 150ms, color 150ms;
    }
    .btn-drop:hover { background: #EF4444; color: #fff; }

    /* ── Empty state ────────────────────────────── */
    .empty-state {
      display: flex; flex-direction: column; align-items: center;
      padding: 4rem 2rem; text-align: center;
    }
    .empty-icon { font-size: 3rem; width: 3rem; height: 3rem; color: #CBD5E1; margin-bottom: 1rem; }
    .empty-state h3 { color: var(--hp-navy, #1E3A5F); margin: 0 0 0.5rem; }
    .empty-state p  { color: #94A3B8; margin: 0; }

    /* ── Drawer ─────────────────────────────────── */
    .drawer-banner {
      height: 90px; display: flex; align-items: center; justify-content: center;
      gap: 0.75rem; margin: -1rem -1rem 0;
    }
    .banner-icon { color: rgba(255,255,255,0.9); font-size: 2rem; width: 2rem; height: 2rem; }
    .banner-label { color: rgba(255,255,255,0.85); font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; }
    .drawer-section { padding: 1rem 0; border-bottom: 1px solid var(--hp-border, #E2E8F0); }
    .drawer-section:last-child { border-bottom: none; }
    .drawer-desc { color: #475569; font-size: 0.9rem; margin: 0; }
    .section-title { font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #94A3B8; margin: 0 0 0.75rem; }
    .section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem; }
    .btn-link { background: none; border: none; color: var(--hp-teal, #2DD4BF); font-size: 0.85rem; font-weight: 600; cursor: pointer; }

    /* Prereq rows */
    .prereq-row {
      display: flex; align-items: center; justify-content: space-between;
      padding: 0.5rem 0;
      border-bottom: 1px solid #F1F5F9;
    }
    .prereq-row:last-child { border-bottom: none; }
    .prereq-row__status { display: flex; align-items: center; gap: 0.25rem; font-size: 0.8rem; font-weight: 600; }
    .prereq-row__status--met   { color: #059669; }
    .prereq-row__status--unmet { color: #DC2626; }
    .prereq-row__status mat-icon { font-size: 16px; width: 16px; height: 16px; }

    /* Round cards */
    .round-card {
      background: #F8FAFC; border-radius: 12px; padding: 1rem 1.25rem;
      margin-bottom: 0.75rem; border: 1px solid var(--hp-border, #E2E8F0);
    }
    .round-card__date { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem; flex-wrap: wrap; }
    .round-icon { color: var(--hp-navy, #1E3A5F); font-size: 20px; width: 20px; height: 20px; flex-shrink: 0; }
    .round-date { font-weight: 700; font-size: 0.9rem; color: var(--hp-navy, #1E3A5F); display: block; }
    .round-time { font-size: 0.8rem; color: #64748B; display: block; }
    .duration-chip {
      background: rgba(30,58,95,0.08); color: var(--hp-navy, #1E3A5F);
      font-size: 0.72rem; font-weight: 600; border-radius: 12px; padding: 2px 10px; margin-left: auto;
    }
    .status-chip-sm { font-size: 0.72rem; font-weight: 700; border-radius: 12px; padding: 2px 10px; text-transform: capitalize; }
    .status-chip-sm--open      { background: rgba(16,185,129,0.1); color: #059669; }
    .status-chip-sm--closed    { background: rgba(239,68,68,0.1); color: #DC2626; }
    .status-chip-sm--cancelled { background: #F1F5F9; color: #94A3B8; }

    .rounds-empty { color: #94A3B8; font-size: 0.875rem; text-align: center; padding: 1.5rem 0; }

    /* Capacity bar */
    .capacity-wrap { margin-bottom: 0.5rem; }
    .capacity-bar { height: 8px; background: #E2E8F0; border-radius: 4px; overflow: hidden; margin-bottom: 0.25rem; }
    .capacity-bar__fill { height: 100%; background: var(--hp-teal, #2DD4BF); border-radius: 4px; transition: width 400ms ease; }
    .capacity-label { font-size: 0.78rem; color: #64748B; }

    .waitlist-row { display: flex; align-items: center; gap: 0.35rem; margin-bottom: 0.5rem; }
    .wl-icon  { color: #D97706; font-size: 16px; width: 16px; height: 16px; }
    .wl-label { font-size: 0.8rem; color: #D97706; font-weight: 500; }

    /* Action buttons */
    .round-action { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
    .action-btn {
      display: inline-flex; align-items: center; gap: 0.4rem;
      border-radius: 8px; padding: 8px 14px; font-size: 0.8rem; font-weight: 600;
      border: none; cursor: pointer; transition: all 150ms; white-space: nowrap;
    }
    .action-btn mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .action-btn--enroll    { background: var(--hp-teal, #2DD4BF); color: #fff; }
    .action-btn--enroll:hover:not(:disabled) { background: #14b8a6; }
    .action-btn--waitlist  { background: #F59E0B; color: #fff; }
    .action-btn--waitlist:hover:not(:disabled) { background: #D97706; }
    .action-btn--drop      { background: none; border: 1px solid #EF4444; color: #EF4444; }
    .action-btn--drop:hover { background: #EF4444; color: #fff; }
    .action-btn--enrolled  { background: rgba(16,185,129,0.1); color: #059669; cursor: default; }
    .action-btn--waitlisted{ background: rgba(245,158,11,0.1); color: #D97706; cursor: default; }
    .action-btn--disabled  { background: #F1F5F9; color: #94A3B8; cursor: not-allowed; }
    .action-btn:disabled   { opacity: 0.65; cursor: not-allowed; }

    /* ── Modals ─────────────────────────────────── */
    .modal-body-inner { padding: 0.5rem 0; }
    .confirm-box {
      display: flex; align-items: flex-start; gap: 1rem;
      background: rgba(45,212,191,0.08); border-radius: 10px;
      padding: 1rem; margin-bottom: 0.75rem;
    }
    .confirm-box--sm { flex-direction: column; gap: 0.25rem; }
    .confirm-box--danger { background: rgba(239,68,68,0.06); }
    .confirm-icon { color: var(--hp-teal, #2DD4BF); font-size: 24px; width: 24px; height: 24px; flex-shrink: 0; margin-top: 2px; }
    .confirm-course { font-weight: 700; color: var(--hp-navy, #1E3A5F); margin: 0; }
    .confirm-date   { font-size: 0.85rem; color: #475569; margin: 0; }
    .confirm-time   { font-size: 0.8rem; color: #64748B; margin: 0; }
    .modal-note     { font-size: 0.8rem; color: #64748B; margin: 0; }
    .warn-note      { color: #D97706; }

    .waitlist-modal-content { display: flex; flex-direction: column; align-items: center; gap: 0.75rem; text-align: center; }
    .wl-position-circle {
      width: 72px; height: 72px; border-radius: 50%;
      background: var(--hp-teal, #2DD4BF); color: #fff;
      display: flex; align-items: center; justify-content: center;
      font-size: 1.75rem; font-weight: 800;
    }
    .wl-title   { font-size: 1rem; color: var(--hp-navy, #1E3A5F); margin: 0; }
    .wl-explain { font-size: 0.85rem; color: #64748B; margin: 0; max-width: 280px; }

    .drop-blocked { display: flex; flex-direction: column; align-items: center; gap: 0.75rem; text-align: center; }
    .drop-blocked__icon { color: #F59E0B; font-size: 2.5rem; width: 2.5rem; height: 2.5rem; }
    .drop-blocked__time { font-size: 0.85rem; font-weight: 600; color: var(--hp-navy, #1E3A5F); margin: 0; }
    .drop-confirm { display: flex; flex-direction: column; gap: 0.75rem; }

    /* ── Admin forms ────────────────────────────── */
    .course-form, .round-form { display: flex; flex-direction: column; gap: 0.75rem; }
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
    .full-width { width: 100%; }
    .prereq-builder__header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem; }
    .prereq-builder__label { font-size: 0.8rem; font-weight: 700; color: var(--hp-navy, #1E3A5F); text-transform: uppercase; letter-spacing: 0.05em; }
    .prereq-rows { display: flex; flex-direction: column; gap: 0.5rem; }
    .prereq-form-row { display: flex; align-items: flex-end; gap: 0.5rem; }
    .prereq-type-field { flex: 1; }
    .prereq-val-field  { width: 120px; }
    .btn-remove { background: none; border: none; cursor: pointer; color: #EF4444; display: flex; align-items: center; padding: 8px; }
    .availableCategories { width: 100%; }
  `],
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
  get currentUserId(): number { return ROLE_USER_ID[this.auth.getCurrentRole() ?? 'resident'] ?? 2; }
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
        this.currentUserId, this.pendingRound.id!, this.auth.getCurrentRole() ?? 'resident',
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
        this.currentUserId, this.pendingRound.id!, this.auth.getCurrentRole() ?? 'resident',
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
        this.currentUserId,
        this.auth.getCurrentRole() ?? 'resident',
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
