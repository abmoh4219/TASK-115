import {
  Component, OnInit,
  ChangeDetectionStrategy, ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

import { ResidentService } from '../../core/services/resident.service';
import { PropertyService } from '../../core/services/property.service';
import { DbService } from '../../core/services/db.service';
import { Resident, Occupancy, Room, Unit, Building } from '../../core/services/db.service';

interface ProfileOccupancy {
  occupancy: Occupancy;
  room:      Room;
  unit:      Unit;
  building:  Building;
}

// =====================================================
// MyProfileComponent — Resident role self-view
// =====================================================

@Component({
  selector: 'app-my-profile',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="profile-page">

      <!-- ── Page header ──────────────────────────── -->
      <div class="page-header">
        <h1 class="page-title">My Profile</h1>
      </div>

      <!-- ── Skeleton ────────────────────────────── -->
      <ng-container *ngIf="loading">
        <div class="skeleton-grid">
          <div class="skeleton-card" *ngFor="let i of [1,2,3]">
            <div class="skeleton-line skeleton-line--title"></div>
            <div class="skeleton-line skeleton-line--sub"></div>
            <div class="skeleton-line skeleton-line--sub" style="width:60%"></div>
          </div>
        </div>
      </ng-container>

      <!-- ── No profile linked ────────────────────── -->
      <ng-container *ngIf="!loading && !resident">
        <div class="empty-state">
          <mat-icon class="empty-icon">person_off</mat-icon>
          <h3>No profile found</h3>
          <p>Your account is not linked to a resident profile. Please contact the property administrator.</p>
        </div>
      </ng-container>

      <!-- ── Profile content ──────────────────────── -->
      <ng-container *ngIf="!loading && resident">

        <!-- Avatar + identity card -->
        <div class="identity-card">
          <div class="identity-card__avatar" [style.background]="avatarBg">
            {{ initials }}
          </div>
          <div class="identity-card__info">
            <h2 class="identity-card__name">{{ resident.firstName }} {{ resident.lastName }}</h2>
            <div class="identity-card__meta">
              <span class="status-chip" [class]="'status-chip--' + resident.status">
                {{ resident.status }}
              </span>
              <span class="member-since">Member since {{ resident.createdAt | date:'MMMM y' }}</span>
            </div>
          </div>
        </div>

        <!-- Cards grid -->
        <div class="cards-grid">

          <!-- Personal info card -->
          <div class="info-card">
            <div class="info-card__header">
              <mat-icon class="info-card__icon">person</mat-icon>
              <span class="info-card__title">Personal Information</span>
            </div>
            <div class="info-card__body">
              <div class="field-row">
                <span class="field-label">Full Name</span>
                <span class="field-value">{{ resident.firstName }} {{ resident.lastName }}</span>
              </div>
              <div class="field-row">
                <span class="field-label">Date of Birth</span>
                <span class="field-value">{{ resident.dateOfBirth | date:'longDate' }}</span>
              </div>
              <div class="field-row">
                <span class="field-label">Status</span>
                <span class="status-chip" [class]="'status-chip--' + resident.status">
                  {{ resident.status }}
                </span>
              </div>
            </div>
          </div>

          <!-- Contact card -->
          <div class="info-card">
            <div class="info-card__header">
              <mat-icon class="info-card__icon">contact_mail</mat-icon>
              <span class="info-card__title">Contact Details</span>
            </div>
            <div class="info-card__body">
              <div class="field-row">
                <span class="field-label">Email</span>
                <span class="field-value">{{ resident.email }}</span>
              </div>
              <div class="field-row">
                <span class="field-label">Phone</span>
                <span class="field-value">{{ resident.phone || '—' }}</span>
              </div>
            </div>
          </div>

          <!-- Room assignment card -->
          <div class="info-card">
            <div class="info-card__header">
              <mat-icon class="info-card__icon">meeting_room</mat-icon>
              <span class="info-card__title">Room Assignment</span>
            </div>
            <div class="info-card__body">

              <ng-container *ngIf="occupancyCtx">
                <div class="field-row">
                  <span class="field-label">Building</span>
                  <span class="field-value">{{ occupancyCtx.building.name }}</span>
                </div>
                <div class="field-row">
                  <span class="field-label">Unit</span>
                  <span class="field-value">{{ occupancyCtx.unit.unitNumber }}</span>
                </div>
                <div class="field-row">
                  <span class="field-label">Room</span>
                  <span class="field-value field-value--highlight">{{ occupancyCtx.room.roomNumber }}</span>
                </div>
                <div class="field-row">
                  <span class="field-label">Since</span>
                  <span class="field-value">{{ occupancyCtx.occupancy.effectiveFrom | date:'mediumDate' }}</span>
                </div>
              </ng-container>

              <ng-container *ngIf="!occupancyCtx">
                <div class="unassigned">
                  <mat-icon class="unassigned__icon">hotel</mat-icon>
                  <p class="unassigned__text">No room currently assigned.</p>
                </div>
              </ng-container>

            </div>
          </div>

          <!-- Consent card -->
          <div class="info-card">
            <div class="info-card__header">
              <mat-icon class="info-card__icon">verified_user</mat-icon>
              <span class="info-card__title">Consent &amp; Privacy</span>
            </div>
            <div class="info-card__body">
              <div class="field-row">
                <span class="field-label">Data Consent</span>
                <span class="consent-badge" [class.consent-badge--granted]="resident.consentGiven" [class.consent-badge--revoked]="!resident.consentGiven">
                  {{ resident.consentGiven ? 'Granted' : 'Not Given' }}
                </span>
              </div>
              <div class="field-row" *ngIf="resident.consentTimestamp">
                <span class="field-label">Consent Date</span>
                <span class="field-value">{{ resident.consentTimestamp | date:'mediumDate' }}</span>
              </div>
              <p class="consent-notice">
                Your data is stored locally and encrypted. Only property staff can access sensitive fields.
              </p>
            </div>
          </div>

        </div>
      </ng-container>

    </div>
  `,
  styles: [`
    :host { display: block; }

    .profile-page {
      padding: 1.75rem 2rem;
      max-width: 1100px;
      margin: 0 auto;
    }

    .page-header { margin-bottom: 1.75rem; }

    .page-title {
      font-size: 1.375rem;
      font-weight: 800;
      color: #111827;
      margin: 0;
    }

    // ── Identity card ──────────────────────────────

    .identity-card {
      display: flex;
      align-items: center;
      gap: 1.25rem;
      background: linear-gradient(135deg, #1e3a5f 0%, #15304f 100%);
      border-radius: 16px;
      padding: 1.75rem 2rem;
      margin-bottom: 1.5rem;
      box-shadow: 0 4px 16px rgba(30,58,95,0.3);
    }

    .identity-card__avatar {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.625rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 1px;
      flex-shrink: 0;
      border: 3px solid rgba(255,255,255,0.25);
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    }

    .identity-card__info { flex: 1; }

    .identity-card__name {
      font-size: 1.375rem;
      font-weight: 800;
      color: #fff;
      margin: 0 0 0.5rem;
    }

    .identity-card__meta {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
    }

    .member-since {
      font-size: 0.8125rem;
      color: rgba(255,255,255,0.6);
    }

    // ── Status chip ────────────────────────────────

    .status-chip {
      display: inline-flex;
      align-items: center;
      padding: 0.125rem 0.625rem;
      border-radius: 20px;
      font-size: 0.6875rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;

      &--active   { background: rgba(209,250,229,0.9); color: #065f46; }
      &--inactive  { background: rgba(243,244,246,0.9); color: #374151; }
      &--pending   { background: rgba(254,243,199,0.9); color: #92400e; }
    }

    // ── Cards grid ─────────────────────────────────

    .cards-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1.25rem;

      @media (max-width: 768px) { grid-template-columns: 1fr; }
    }

    // ── Info card ──────────────────────────────────

    .info-card {
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.05);
      overflow: hidden;
    }

    .info-card__header {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      padding: 1rem 1.25rem;
      border-bottom: 1px solid #f3f4f6;
      background: #fafafa;
    }

    .info-card__icon {
      font-size: 1.125rem;
      width: 1.125rem;
      height: 1.125rem;
      color: #1e3a5f;
    }

    .info-card__title {
      font-size: 0.875rem;
      font-weight: 700;
      color: #374151;
    }

    .info-card__body {
      padding: 0.25rem 0;
      display: flex;
      flex-direction: column;
    }

    // ── Field rows ─────────────────────────────────

    .field-row {
      display: flex;
      align-items: center;
      padding: 0.625rem 1.25rem;
      border-bottom: 1px solid #f9fafb;

      &:last-child { border-bottom: none; }
    }

    .field-label {
      width: 110px;
      flex-shrink: 0;
      font-size: 0.8125rem;
      color: #9ca3af;
      font-weight: 500;
    }

    .field-value {
      flex: 1;
      font-size: 0.875rem;
      color: #111827;
      font-weight: 500;

      &--highlight {
        font-weight: 700;
        color: #1e3a5f;
      }
    }

    // ── Unassigned state ───────────────────────────

    .unassigned {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      padding: 0.75rem 1.25rem;
      color: #9ca3af;
    }

    .unassigned__icon { font-size: 1.125rem; width: 1.125rem; height: 1.125rem; }
    .unassigned__text { font-size: 0.875rem; margin: 0; }

    // ── Consent ────────────────────────────────────

    .consent-badge {
      display: inline-flex;
      padding: 0.125rem 0.625rem;
      border-radius: 20px;
      font-size: 0.6875rem;
      font-weight: 700;
      text-transform: uppercase;

      &--granted { background: #d1fae5; color: #065f46; }
      &--revoked { background: #fee2e2; color: #991b1b; }
    }

    .consent-notice {
      padding: 0.5rem 1.25rem 0.75rem;
      font-size: 0.75rem;
      color: #9ca3af;
      margin: 0;
      line-height: 1.5;
    }

    // ── Skeleton ───────────────────────────────────

    @keyframes shimmer {
      0%   { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    %skeleton-pulse {
      background: linear-gradient(90deg, #f1f5f9 25%, #e9edf2 50%, #f1f5f9 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
      border-radius: 4px;
    }

    .skeleton-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1.25rem;
    }

    .skeleton-card {
      @extend %skeleton-pulse;
      height: 160px;
      border-radius: 12px;
    }

    .skeleton-line {
      @extend %skeleton-pulse;
      height: 14px;
      margin: 0.5rem 0;

      &--title { height: 18px; width: 50%; }
      &--sub   { width: 80%; }
    }

    // ── Empty state ────────────────────────────────

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 4rem 2rem;
      text-align: center;
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 16px;

      h3 { font-size: 1.125rem; color: #374151; margin: 1rem 0 0.5rem; }
      p  { font-size: 0.875rem; color: #9ca3af; margin: 0; max-width: 320px; }
    }

    .empty-icon {
      font-size: 3rem;
      width: 3rem;
      height: 3rem;
      color: #d1d5db;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyProfileComponent implements OnInit {

  loading      = true;
  resident:    Resident | null = null;
  occupancyCtx: ProfileOccupancy | null = null;

  private readonly AVATAR_COLORS = [
    '#1e3a5f', '#0d9488', '#7c3aed', '#db2777',
    '#ea580c', '#16a34a', '#2563eb', '#b45309',
  ];

  constructor(
    private residentService: ResidentService,
    private propertyService: PropertyService,
    private db:  DbService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadProfile();
  }

  private async loadProfile(): Promise<void> {
    this.loading = true;
    this.cdr.markForCheck();
    try {
      // For the resident role: find the resident matching the current session
      // Since auth uses role-based login (not individual accounts), we show the
      // first active resident as a demo placeholder. In a real system, the
      // resident ID would be stored on the auth session.
      const all = await this.residentService.getResidents({ status: ['active'] });
      this.resident = all[0] ?? null;

      if (this.resident?.id != null) {
        const activeOcc = await this.propertyService.getActiveOccupancy(this.resident.id);
        if (activeOcc) {
          const room = await this.db.rooms.get(activeOcc.roomId);
          if (room) {
            const unit = await this.db.units.get(room.unitId);
            if (unit) {
              const building = await this.db.buildings.get(unit.buildingId);
              if (building) {
                this.occupancyCtx = { occupancy: activeOcc, room, unit, building };
              }
            }
          }
        }
      }
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  get initials(): string {
    if (!this.resident) return '?';
    return `${this.resident.firstName[0] ?? ''}${this.resident.lastName[0] ?? ''}`.toUpperCase();
  }

  get avatarBg(): string {
    if (!this.resident) return '#1e3a5f';
    const name = `${this.resident.firstName}${this.resident.lastName}`;
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = (hash * 31 + name.charCodeAt(i)) & 0xffffffff;
    }
    return this.AVATAR_COLORS[Math.abs(hash) % this.AVATAR_COLORS.length];
  }
}
