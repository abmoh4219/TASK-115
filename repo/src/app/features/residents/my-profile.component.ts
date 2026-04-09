import {
  Component, OnInit,
  ChangeDetectionStrategy, ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

import { ResidentService } from '../../core/services/resident.service';
import { PropertyService } from '../../core/services/property.service';
import { DocumentService } from '../../core/services/document.service';
import { DbService } from '../../core/services/db.service';
import { Resident, Occupancy, Room, Unit, Building } from '../../core/services/db.service';
import { DocumentUploadComponent } from '../documents/document-upload.component';
import { ToastService } from '../../shared/components/toast/toast.service';

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
  imports: [CommonModule, MatIconModule, DocumentUploadComponent],
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

        <!-- ── Consent revocation section ───────────── -->
        <div class="consent-section" [class.consent-section--granted]="resident.consentGiven" [class.consent-section--revoked]="!resident.consentGiven">
          <div class="consent-section__header">
            <div>
              <h3 class="consent-section__title">Document Consent</h3>
              <p class="consent-section__desc">
                {{ resident.consentGiven
                   ? 'You have granted consent to store and review your documents.'
                   : 'Consent has not been granted or has been revoked. Documents are hidden from staff.' }}
              </p>
            </div>
            <div class="consent-section__actions">
              <span class="consent-status-chip" [class.consent-status-chip--granted]="resident.consentGiven" [class.consent-status-chip--revoked]="!resident.consentGiven">
                {{ resident.consentGiven ? 'Consent Active' : 'Consent Revoked' }}
              </span>
              <button
                class="btn-consent"
                [class.btn-consent--revoke]="resident.consentGiven"
                [class.btn-consent--grant]="!resident.consentGiven"
                [disabled]="consentChanging"
                (click)="toggleConsent()"
              >
                {{ consentChanging ? 'Please wait…' : (resident.consentGiven ? 'Revoke Consent' : 'Grant Consent') }}
              </button>
            </div>
          </div>
        </div>

        <!-- ── Documents section ─────────────────────── -->
        <div class="docs-section">
          <h3 class="docs-section__title">My Documents</h3>
          <p class="docs-section__sub">Upload ID, lease addenda, or other required documents.</p>
          <app-document-upload
            [residentId]="resident.id ?? null"
            [readonly]="false"
          ></app-document-upload>
        </div>

      </ng-container>

    </div>
  `,
  styleUrls: ['./my-profile.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyProfileComponent implements OnInit {

  loading        = true;
  resident:      Resident | null = null;
  occupancyCtx:  ProfileOccupancy | null = null;
  consentChanging = false;

  private readonly AVATAR_COLORS = [
    '#1e3a5f', '#0d9488', '#7c3aed', '#db2777',
    '#ea580c', '#16a34a', '#2563eb', '#b45309',
  ];

  constructor(
    private residentService: ResidentService,
    private propertyService: PropertyService,
    private docService:      DocumentService,
    private db:  DbService,
    private toast: ToastService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadProfile();
  }

  async toggleConsent(): Promise<void> {
    if (!this.resident?.id) return;
    this.consentChanging = true;
    this.cdr.markForCheck();
    try {
      if (this.resident.consentGiven) {
        await this.docService.revokeConsent(this.resident.id);
        this.toast.show('Consent revoked. Your documents are now hidden from staff.', 'info');
      } else {
        await this.docService.grantConsent(this.resident.id);
        this.toast.show('Consent granted. You can now upload documents.', 'success');
      }
      // Refresh resident record
      const updated = await this.residentService.getResident(this.resident.id);
      if (updated) this.resident = updated;
    } catch {
      this.toast.show('Failed to update consent. Please try again.', 'error');
    } finally {
      this.consentChanging = false;
      this.cdr.markForCheck();
    }
  }

  private async loadProfile(): Promise<void> {
    this.loading = true;
    this.cdr.markForCheck();
    try {
      // Retrieve the resident profile bound to the authenticated session user
      const profile = await this.residentService.getMyProfile();
      this.resident = profile ?? null;

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
