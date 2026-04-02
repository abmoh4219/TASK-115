import {
  Component, Input, Output, EventEmitter,
  ChangeDetectionStrategy, OnChanges, SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { DrawerComponent } from '../../shared/components/drawer/drawer.component';
import { TableComponent, TableColumn } from '../../shared/components/table/table.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { Building, Unit, Room } from '../../core/services/db.service';

export interface BuildingStatViewModel {
  building: Building;
  unitCount: number;
  roomCount: number;
  occupancyCount: number;
  occupancyRate: number;
}

@Component({
  selector: 'app-building-drawer',
  standalone: true,
  imports: [
    CommonModule,
    MatTabsModule,
    MatButtonModule,
    MatIconModule,
    DrawerComponent,
    TableComponent,
    EmptyStateComponent,
  ],
  template: `
    <app-drawer
      [open]="open"
      [title]="buildingStat?.building?.name || ''"
      [subtitle]="buildingStat?.building?.address || ''"
      (closed)="closed.emit()"
    >
      <!-- Content -->
      <mat-tab-group class="building-tabs" animationDuration="200ms">
        <!-- Units Tab -->
        <mat-tab label="Units">
          <div class="tab-toolbar">
            <span class="tab-count">{{ units.length }} unit{{ units.length !== 1 ? 's' : '' }}</span>
            <button mat-raised-button class="btn-teal" (click)="addUnitClicked.emit()">
              <mat-icon>add</mat-icon>
              Add Unit
            </button>
          </div>

          <app-table
            *ngIf="units.length > 0"
            [columns]="unitColumns"
            [data]="unitRows"
            emptyMessage="No units in this building"
            emptyIcon="meeting_room"
            (rowClick)="onUnitRowClick($event)"
          ></app-table>

          <app-empty-state
            *ngIf="units.length === 0"
            icon="meeting_room"
            title="No units yet"
            description="Add the first unit to this building."
            [compact]="true"
          >
            <button mat-raised-button class="btn-teal" (click)="addUnitClicked.emit()">
              <mat-icon>add</mat-icon>
              Add Unit
            </button>
          </app-empty-state>
        </mat-tab>

        <!-- Info Tab -->
        <mat-tab label="Info">
          <div class="info-panel" *ngIf="buildingStat">
            <div class="info-row">
              <span class="info-label">Name</span>
              <span class="info-value">{{ buildingStat.building.name }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Address</span>
              <span class="info-value">{{ buildingStat.building.address }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Floors</span>
              <span class="info-value">{{ buildingStat.building.floors }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Total Units</span>
              <span class="info-value">{{ buildingStat.unitCount }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Total Rooms</span>
              <span class="info-value">{{ buildingStat.roomCount }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Occupancy Rate</span>
              <span class="info-value" [style.color]="occupancyColor(buildingStat.occupancyRate)">
                {{ buildingStat.occupancyRate }}%
              </span>
            </div>
          </div>
        </mat-tab>
      </mat-tab-group>
    </app-drawer>
  `,
  styles: [`
    :host { display: block; }

    .building-tabs {
      margin: 0 -1rem;

      ::ng-deep .mat-mdc-tab-labels { padding: 0 1rem; }

      ::ng-deep .mat-mdc-tab-header {
        border-bottom: 1px solid #e5e7eb;
      }

      ::ng-deep .mat-mdc-tab.mdc-tab--active .mdc-tab__text-label {
        color: #2dd4bf;
      }

      ::ng-deep .mat-mdc-tab-indicator .mdc-tab-indicator__content--underline {
        border-color: #2dd4bf;
      }
    }

    .tab-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 1rem 0.75rem;
    }

    .tab-count {
      font-size: 0.8125rem;
      color: #6b7280;
      font-weight: 500;
    }

    .btn-teal {
      background: #2dd4bf !important;
      color: #fff !important;
      border-radius: 6px !important;
      font-size: 0.8125rem !important;
      font-weight: 600 !important;
      padding: 0 0.875rem !important;
      height: 32px !important;
      line-height: 32px !important;
      box-shadow: none !important;

      mat-icon { font-size: 1rem; width: 1rem; height: 1rem; margin-right: 4px; }
    }

    .info-panel {
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .info-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.5rem 0;
      border-bottom: 1px solid #f3f4f6;

      &:last-child { border-bottom: none; }
    }

    .info-label {
      font-size: 0.8125rem;
      color: #6b7280;
      font-weight: 500;
    }

    .info-value {
      font-size: 0.875rem;
      color: #111827;
      font-weight: 600;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BuildingDrawerComponent implements OnChanges {

  @Input() open = false;
  @Input() buildingStat: BuildingStatViewModel | null = null;
  @Input() units: Unit[] = [];
  @Input() rooms: Room[] = [];

  @Output() closed = new EventEmitter<void>();
  @Output() unitSelected = new EventEmitter<Unit>();
  @Output() addUnitClicked = new EventEmitter<void>();

  readonly unitColumns: TableColumn[] = [
    { key: 'unitNumber', header: 'Unit #',  sortable: true, width: '90px' },
    { key: 'floor',      header: 'Floor',   sortable: true, width: '70px' },
    { key: 'type',       header: 'Type',    sortable: true },
    { key: 'roomCount',  header: 'Rooms',   sortable: true, width: '70px' },
  ];

  unitRows: Record<string, unknown>[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['units'] || changes['rooms']) {
      this.unitRows = this.units.map(u => ({
        id: u.id,
        unitNumber: u.unitNumber,
        floor: u.floor,
        type: u.type,
        roomCount: this.rooms.filter(r => r.unitId === u.id).length,
      }));
    }
  }

  onUnitRowClick(row: Record<string, unknown>): void {
    const unit = this.units.find(u => u.id === row['id']);
    if (unit) this.unitSelected.emit(unit);
  }

  occupancyColor(rate: number): string {
    if (rate >= 95) return '#ef4444';
    if (rate >= 80) return '#f59e0b';
    return '#10b981';
  }
}
