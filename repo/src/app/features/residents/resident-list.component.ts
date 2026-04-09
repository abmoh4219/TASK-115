import {
  Component, OnInit, ViewChild, TemplateRef, AfterViewInit,
  ChangeDetectionStrategy, ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';

import { TableComponent, TableColumn } from '../../shared/components/table/table.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { ToastService } from '../../shared/components/toast/toast.service';

import { ResidentService, ResidentFilters, CreateResidentData } from '../../core/services/resident.service';
import { PropertyService, ReasonCode } from '../../core/services/property.service';
import { AuthService } from '../../core/services/auth.service';
import { DbService, Resident, Building, Occupancy, Room } from '../../core/services/db.service';

import { AddResidentModalComponent } from './add-resident-modal.component';
import { ResidentDrawerComponent } from './resident-drawer.component';
import { MoveInModalComponent, MoveInPayload } from '../property/move-in-modal.component';
import { MoveOutModalComponent, MoveOutPayload } from '../property/move-out-modal.component';

// =====================================================
// ResidentListComponent — two-panel layout
// =====================================================

@Component({
  selector: 'app-resident-list',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatIconModule, MatButtonModule, MatCheckboxModule,
    TableComponent, EmptyStateComponent,
    AddResidentModalComponent, ResidentDrawerComponent,
    MoveInModalComponent, MoveOutModalComponent,
  ],
  template: `
    <div class="residents-page">

      <!-- ── Page header ──────────────────────────── -->
      <div class="page-header">
        <div class="page-header__left">
          <h1 class="page-title">Residents</h1>
          <span class="count-badge">{{ filtered.length }}</span>
        </div>
        <button class="btn-primary" (click)="openAddModal = true" *ngIf="isAdmin">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
            <line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
          </svg>
          Add Resident
        </button>
      </div>

      <!-- ── Two-panel layout ──────────────────────── -->
      <div class="panels">

        <!-- ── Sidebar filters ──────────────────────── -->
        <aside class="sidebar">

          <!-- Search -->
          <div class="filter-block">
            <label class="filter-label">Search</label>
            <div class="search-wrap">
              <svg class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none">
                <circle cx="11" cy="11" r="8" stroke="#9ca3af" stroke-width="2"/>
                <path d="m21 21-4.35-4.35" stroke="#9ca3af" stroke-width="2" stroke-linecap="round"/>
              </svg>
              <input
                class="search-input"
                type="text"
                placeholder="Name or email…"
                [(ngModel)]="searchQuery"
                (ngModelChange)="applyFilters()"
              />
              <button
                *ngIf="searchQuery"
                class="search-clear"
                (click)="searchQuery = ''; applyFilters()"
              >×</button>
            </div>
          </div>

          <!-- Status filter -->
          <div class="filter-block">
            <label class="filter-label">Status</label>
            <div class="checkbox-list">
              <label class="checkbox-item" *ngFor="let s of statusOptions">
                <input
                  type="checkbox"
                  class="checkbox"
                  [checked]="selectedStatuses.has(s.value)"
                  (change)="toggleStatus(s.value)"
                />
                <span class="status-dot" [class]="'status-dot--' + s.value"></span>
                <span>{{ s.label }}</span>
                <span class="status-count">{{ statusCounts[s.value] || 0 }}</span>
              </label>
            </div>
          </div>

          <!-- Building filter -->
          <div class="filter-block" *ngIf="buildings.length > 0">
            <label class="filter-label">Building</label>
            <div class="checkbox-list">
              <label class="checkbox-item">
                <input
                  type="checkbox"
                  class="checkbox"
                  [checked]="selectedBuildingId === null"
                  (change)="selectedBuildingId = null; applyFilters()"
                />
                <span>All buildings</span>
              </label>
              <label class="checkbox-item" *ngFor="let b of buildings">
                <input
                  type="checkbox"
                  class="checkbox"
                  [checked]="selectedBuildingId === b.id"
                  (change)="selectedBuildingId = selectedBuildingId === b.id ? null : b.id!; applyFilters()"
                />
                <span>{{ b.name }}</span>
              </label>
            </div>
          </div>

          <!-- Clear button -->
          <button
            class="clear-btn"
            *ngIf="hasActiveFilters"
            (click)="clearFilters()"
          >
            Clear filters
          </button>

        </aside>

        <!-- ── Main table ────────────────────────────── -->
        <main class="main-panel">

          <app-table
            [columns]="columns"
            [data]="tableRows"
            [loading]="loading"
            emptyMessage="No residents found"
            emptyIcon="people"
            (rowClick)="onRowClick($event)"
          >
          </app-table>

          <!-- Custom cell templates -->
          <ng-template #avatarTpl let-v let-row="row">
            <div class="avatar-cell">
              <div
                class="avatar-sm"
                [style.background]="avatarBg(row['firstName'], row['lastName'])"
              >
                {{ (row['firstName'] + '')[0] }}{{ (row['lastName'] + '')[0] }}
              </div>
              <div class="avatar-cell__info">
                <span class="avatar-cell__name">{{ row['firstName'] }} {{ row['lastName'] }}</span>
                <span class="avatar-cell__email">{{ maskEmail(row['email'] + '') }}</span>
              </div>
            </div>
          </ng-template>

          <ng-template #statusTpl let-v>
            <span class="status-chip" [class]="'status-chip--' + v">{{ v }}</span>
          </ng-template>

          <ng-template #roomTpl let-v>
            <span *ngIf="v" class="room-tag">{{ v }}</span>
            <span *ngIf="!v" class="room-tag room-tag--empty">—</span>
          </ng-template>

        </main>
      </div>

      <!-- ── Resident Drawer ───────────────────────── -->
      <app-resident-drawer
        [open]="drawerOpen"
        [residentId]="selectedResidentId"
        [currentRole]="currentRole"
        (closed)="drawerOpen = false"
        (residentUpdated)="onResidentUpdated($event)"
        (moveInRequested)="onMoveInFromDrawer($event)"
        (moveOutRequested)="onMoveOutFromDrawer($event)"
      ></app-resident-drawer>

      <!-- ── Add Resident Modal ────────────────────── -->
      <app-add-resident-modal
        [open]="openAddModal"
        [saving]="savingResident"
        (confirmed)="onAddResident($event)"
        (cancelled)="openAddModal = false"
      ></app-add-resident-modal>

      <!-- ── Move-In Modal (from drawer) ──────────── -->
      <app-move-in-modal
        [open]="moveInOpen"
        [room]="moveInRoom"
        [availableRooms]="moveInRooms"
        [availableResidents]="moveInResidents"
        [saving]="movingSaving"
        (confirmed)="confirmMoveIn($event)"
        (cancelled)="moveInOpen = false"
      ></app-move-in-modal>

      <!-- ── Move-Out Modal (from drawer) ─────────── -->
      <app-move-out-modal
        [open]="moveOutOpen"
        [data]="moveOutData"
        [saving]="movingSaving"
        (confirmed)="confirmMoveOut($event)"
        (cancelled)="moveOutOpen = false"
      ></app-move-out-modal>

    </div>
  `,
  styleUrls: ['./resident-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResidentListComponent implements OnInit, AfterViewInit {

  @ViewChild('avatarTpl') avatarTpl!: TemplateRef<any>;
  @ViewChild('statusTpl') statusTpl!: TemplateRef<any>;
  @ViewChild('roomTpl')   roomTpl!:   TemplateRef<any>;

  // --------------------------------------------------
  // Data
  // --------------------------------------------------

  loading   = true;
  all:      Resident[] = [];
  filtered: Resident[] = [];
  buildings: Building[] = [];

  /** residentId → room number string */
  private roomMap = new Map<number, string>();

  // --------------------------------------------------
  // Filter state
  // --------------------------------------------------

  searchQuery     = '';
  selectedStatuses = new Set<string>(['active', 'inactive', 'pending']);
  selectedBuildingId: number | null = null;

  readonly statusOptions = [
    { value: 'active',   label: 'Active' },
    { value: 'pending',  label: 'Pending' },
    { value: 'inactive', label: 'Inactive' },
  ];

  // --------------------------------------------------
  // Table
  // --------------------------------------------------

  columns: TableColumn[] = [];
  tableRows: Record<string, unknown>[] = [];

  // --------------------------------------------------
  // Drawer
  // --------------------------------------------------

  drawerOpen        = false;
  selectedResidentId: number | null = null;

  // --------------------------------------------------
  // Add modal
  // --------------------------------------------------

  openAddModal    = false;
  savingResident  = false;

  // --------------------------------------------------
  // Move-in modal (from drawer)
  // --------------------------------------------------

  moveInOpen      = false;
  moveInRoom:     Room | null = null;
  moveInRooms:    Room[] = [];
  moveInResidents: Resident[] = [];
  movingSaving    = false;
  private pendingMoveInResident: Resident | null = null;

  // --------------------------------------------------
  // Move-out modal (from drawer)
  // --------------------------------------------------

  moveOutOpen = false;
  moveOutData: { room: Room; occupancy: Occupancy; resident: Resident } | null = null;

  // --------------------------------------------------
  // Auth
  // --------------------------------------------------

  get currentRole() {
    return this.auth.getCurrentRole() ?? 'admin';
  }

  get isAdmin(): boolean {
    return this.currentRole === 'admin';
  }

  private readonly AVATAR_COLORS = [
    '#1e3a5f', '#0d9488', '#7c3aed', '#db2777',
    '#ea580c', '#16a34a', '#2563eb', '#b45309',
  ];

  constructor(
    private residentService: ResidentService,
    private propertyService: PropertyService,
    private db:    DbService,
    private auth:  AuthService,
    private toast: ToastService,
    private cdr:   ChangeDetectorRef,
    private route: ActivatedRoute,
  ) {}

  // --------------------------------------------------
  // Lifecycle
  // --------------------------------------------------

  ngOnInit(): void {
    this.loadData().then(() => {
      // Handle deep-link from search results
      const openId = this.route.snapshot.queryParamMap.get('openId');
      if (openId) {
        this.selectedResidentId = Number(openId);
        this.drawerOpen = true;
        this.cdr.markForCheck();
      }
    });
  }

  ngAfterViewInit(): void {
    this.columns = [
      { key: 'name',   header: 'Resident', template: this.avatarTpl, width: '260px' },
      { key: 'status', header: 'Status',   template: this.statusTpl, width: '100px', sortable: true },
      { key: 'room',   header: 'Room',     template: this.roomTpl,   width: '80px' },
    ];
    this.rebuildTableRows();
    this.cdr.markForCheck();
  }

  // --------------------------------------------------
  // Load
  // --------------------------------------------------

  private async loadData(): Promise<void> {
    this.loading = true;
    this.cdr.markForCheck();
    try {
      const [residents, buildings, occs] = await Promise.all([
        this.residentService.getResidents(),
        this.propertyService.getBuildings(),
        this.db.occupancies.filter((o: Occupancy) => o.status === 'active').toArray(),
      ]);
      this.all       = residents;
      this.buildings = buildings;
      await this.buildRoomMap(occs);
      this.applyFilters();
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  private async buildRoomMap(occs: Occupancy[]): Promise<void> {
    this.roomMap.clear();
    for (const occ of occs) {
      const room = await this.db.rooms.get(occ.roomId);
      if (room) {
        this.roomMap.set(occ.residentId, room.roomNumber);
      }
    }
  }

  // --------------------------------------------------
  // Filters
  // --------------------------------------------------

  applyFilters(): void {
    const statuses = Array.from(this.selectedStatuses) as ('active' | 'inactive' | 'pending')[];
    this.residentService.getResidents({
      status:     statuses.length < 3 ? statuses : undefined,
      search:     this.searchQuery || undefined,
      buildingId: this.selectedBuildingId ?? undefined,
    }).then(results => {
      this.filtered = results;
      this.rebuildTableRows();
      this.cdr.markForCheck();
    });
  }

  toggleStatus(value: string): void {
    if (this.selectedStatuses.has(value)) {
      this.selectedStatuses.delete(value);
    } else {
      this.selectedStatuses.add(value);
    }
    this.applyFilters();
  }

  clearFilters(): void {
    this.searchQuery = '';
    this.selectedStatuses = new Set(['active', 'inactive', 'pending']);
    this.selectedBuildingId = null;
    this.applyFilters();
  }

  get hasActiveFilters(): boolean {
    return !!(this.searchQuery ||
      this.selectedStatuses.size < 3 ||
      this.selectedBuildingId != null);
  }

  get statusCounts(): Record<string, number> {
    const counts: Record<string, number> = { active: 0, inactive: 0, pending: 0 };
    for (const r of this.all) {
      if (counts[r.status] !== undefined) counts[r.status]++;
    }
    return counts;
  }

  // --------------------------------------------------
  // Table rows
  // --------------------------------------------------

  private rebuildTableRows(): void {
    this.tableRows = this.filtered.map(r => ({
      id:        r.id,
      name:      `${r.firstName} ${r.lastName}`,
      firstName: r.firstName,
      lastName:  r.lastName,
      email:     r.email,
      status:    r.status,
      room:      this.roomMap.get(r.id!) ?? null,
    }));
  }

  // --------------------------------------------------
  // Row click
  // --------------------------------------------------

  onRowClick(row: Record<string, unknown>): void {
    this.selectedResidentId = row['id'] as number;
    this.drawerOpen = true;
    this.cdr.markForCheck();
  }

  // --------------------------------------------------
  // Add resident
  // --------------------------------------------------

  async onAddResident(data: CreateResidentData): Promise<void> {
    this.savingResident = true;
    this.cdr.markForCheck();
    try {
      await this.residentService.createResident(data);
      this.openAddModal = false;
      this.toast.show('Resident added successfully', 'success');
      await this.loadData();
    } catch {
      this.toast.show('Failed to add resident', 'error');
    } finally {
      this.savingResident = false;
      this.cdr.markForCheck();
    }
  }

  // --------------------------------------------------
  // Drawer events
  // --------------------------------------------------

  onResidentUpdated(resident: Resident): void {
    const idx = this.all.findIndex(r => r.id === resident.id);
    if (idx >= 0) this.all[idx] = resident;
    this.applyFilters();
  }

  async onMoveInFromDrawer(resident: Resident): Promise<void> {
    this.pendingMoveInResident = resident;
    // For move-in from drawer: no specific room context; load available rooms for selection
    this.moveInRoom       = null;
    this.moveInResidents  = [resident];
    // Load all rooms so the user can select one
    this.moveInRooms      = await this.db.rooms.toArray();
    this.moveInOpen       = true;
    this.cdr.markForCheck();
  }

  async onMoveOutFromDrawer(resident: Resident): Promise<void> {
    if (!resident.id) return;
    const activeOcc = await this.propertyService.getActiveOccupancy(resident.id);
    if (!activeOcc) {
      this.toast.show('Resident has no active occupancy', 'warning');
      return;
    }
    const room = await this.db.rooms.get(activeOcc.roomId);
    if (!room) return;
    this.moveOutData = { room, occupancy: activeOcc, resident };
    this.moveOutOpen = true;
    this.cdr.markForCheck();
  }

  // --------------------------------------------------
  // Move-in / move-out confirm
  // --------------------------------------------------

  async confirmMoveIn(payload: MoveInPayload): Promise<void> {
    const roomId = this.moveInRoom?.id ?? payload.roomId;
    if (!roomId) {
      this.toast.show('Please select a room before confirming move-in', 'error');
      return;
    }
    this.movingSaving = true;
    this.cdr.markForCheck();
    try {
      await this.propertyService.moveIn({
        residentId:   payload.residentId,
        roomId:       roomId as number,
        effectiveFrom: payload.effectiveFrom,
        reasonCode:   payload.reasonCode as ReasonCode,
      });
      this.moveInOpen = false;
      this.toast.show('Move-in recorded', 'success');
      await this.loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Move-in failed';
      this.toast.show(msg, 'error');
    } finally {
      this.movingSaving = false;
      this.cdr.markForCheck();
    }
  }

  async confirmMoveOut(payload: MoveOutPayload): Promise<void> {
    if (!this.moveOutData?.resident?.id) return;
    this.movingSaving = true;
    this.cdr.markForCheck();
    try {
      await this.propertyService.moveOut({
        residentId:  this.moveOutData.resident.id!,
        effectiveTo: payload.effectiveTo,
        reasonCode:  payload.reasonCode as ReasonCode,
      });
      this.moveOutOpen = false;
      this.toast.show('Move-out recorded', 'success');
      await this.loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Move-out failed';
      this.toast.show(msg, 'error');
    } finally {
      this.movingSaving = false;
      this.cdr.markForCheck();
    }
  }

  // --------------------------------------------------
  // Avatar helpers
  // --------------------------------------------------

  avatarBg(first: unknown, last: unknown): string {
    const name = `${first ?? ''}${last ?? ''}`;
    if (!name.trim()) return '#1e3a5f';
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = (hash * 31 + name.charCodeAt(i)) & 0xffffffff;
    }
    return this.AVATAR_COLORS[Math.abs(hash) % this.AVATAR_COLORS.length];
  }

  maskEmail(email: string): string {
    if (!email || !email.includes('@')) return email;
    const [local, domain] = email.split('@');
    return `${local[0]}***@${domain}`;
  }
}
