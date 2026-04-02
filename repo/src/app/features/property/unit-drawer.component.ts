import {
  Component, Input, Output, EventEmitter,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import { DrawerComponent } from '../../shared/components/drawer/drawer.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { Unit, Room, Occupancy, Resident } from '../../core/services/db.service';

export interface RoomOccupant {
  occupancy: Occupancy;
  resident: Resident;
}

@Component({
  selector: 'app-unit-drawer',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    DrawerComponent,
    EmptyStateComponent,
  ],
  template: `
    <app-drawer
      [open]="open"
      [title]="unit ? 'Unit ' + unit.unitNumber : ''"
      [subtitle]="unit ? 'Floor ' + unit.floor + ' · ' + unit.type : ''"
      (closed)="closed.emit()"
    >
      <!-- Toolbar -->
      <div class="rooms-toolbar">
        <span class="rooms-count">
          {{ rooms.length }} room{{ rooms.length !== 1 ? 's' : '' }}
        </span>
        <button mat-raised-button class="btn-teal" (click)="addRoomClicked.emit()">
          <mat-icon>add</mat-icon>
          Add Room
        </button>
      </div>

      <!-- Room List -->
      <div class="rooms-list" *ngIf="rooms.length > 0">
        <div
          *ngFor="let room of rooms"
          class="room-row"
          [class.room-row--occupied]="!!getOccupant(room.id!)"
          [class.room-row--vacant]="!getOccupant(room.id!)"
          (click)="onRoomClick(room)"
          role="button"
          tabindex="0"
          (keydown.enter)="onRoomClick(room)"
          [matTooltip]="getOccupant(room.id!) ? 'Click to move out' : 'Click to move in'"
        >
          <div class="room-row__left">
            <div class="room-row__number">
              <mat-icon class="room-row__icon">{{ getOccupant(room.id!) ? 'person' : 'meeting_room' }}</mat-icon>
              {{ room.roomNumber }}
            </div>

            <span class="capacity-chip">
              <mat-icon>group</mat-icon>
              {{ room.capacity }}
            </span>
          </div>

          <div class="room-row__right">
            <ng-container *ngIf="getOccupant(room.id!) as occ; else vacant">
              <div class="occupant-info">
                <div class="occupant-avatar">
                  {{ occ.resident.firstName[0] }}{{ occ.resident.lastName[0] }}
                </div>
                <div class="occupant-name">
                  {{ occ.resident.firstName }} {{ occ.resident.lastName }}
                </div>
              </div>
              <mat-icon class="action-icon action-icon--out" matTooltip="Move out">logout</mat-icon>
            </ng-container>

            <ng-template #vacant>
              <span class="vacant-label">Vacant</span>
              <mat-icon class="action-icon action-icon--in" matTooltip="Move in">login</mat-icon>
            </ng-template>
          </div>
        </div>
      </div>

      <!-- Empty -->
      <app-empty-state
        *ngIf="rooms.length === 0"
        icon="meeting_room"
        title="No rooms yet"
        description="Add rooms to this unit to manage occupancy."
        [compact]="true"
      >
        <button mat-raised-button class="btn-teal" (click)="addRoomClicked.emit()">
          <mat-icon>add</mat-icon>
          Add Room
        </button>
      </app-empty-state>
    </app-drawer>
  `,
  styles: [`
    :host { display: block; }

    .rooms-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.5rem 0 1rem;
    }

    .rooms-count {
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

    .rooms-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .room-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.875rem 1rem;
      border-radius: 8px;
      background: #fff;
      border: 1px solid #e5e7eb;
      cursor: pointer;
      transition: box-shadow 150ms, border-color 150ms;

      &:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.08); }

      &--vacant {
        border-left: 3px dashed #2dd4bf;
      }

      &--occupied {
        border-left: 3px solid #1e3a5f;
      }
    }

    .room-row__left {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .room-row__number {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      font-size: 0.9375rem;
      font-weight: 600;
      color: #111827;
    }

    .room-row__icon {
      font-size: 1.125rem;
      width: 1.125rem;
      height: 1.125rem;
      color: #6b7280;
    }

    .capacity-chip {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.125rem 0.5rem;
      background: #f3f4f6;
      border-radius: 20px;
      font-size: 0.75rem;
      font-weight: 600;
      color: #6b7280;

      mat-icon {
        font-size: 0.875rem;
        width: 0.875rem;
        height: 0.875rem;
      }
    }

    .room-row__right {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .occupant-info {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .occupant-avatar {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: #1e3a5f;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.6875rem;
      font-weight: 700;
      text-transform: uppercase;
      flex-shrink: 0;
    }

    .occupant-name {
      font-size: 0.875rem;
      font-weight: 500;
      color: #374151;
    }

    .vacant-label {
      font-size: 0.875rem;
      font-style: italic;
      color: #2dd4bf;
      font-weight: 500;
    }

    .action-icon {
      font-size: 1.125rem;
      width: 1.125rem;
      height: 1.125rem;
      opacity: 0.5;

      &--in  { color: #2dd4bf; }
      &--out { color: #ef4444; }
    }

    .room-row:hover .action-icon { opacity: 1; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UnitDrawerComponent {

  @Input() open = false;
  @Input() unit: Unit | null = null;
  @Input() rooms: Room[] = [];
  @Input() occupantsMap: Map<number, RoomOccupant | null> = new Map();

  @Output() closed = new EventEmitter<void>();
  @Output() addRoomClicked = new EventEmitter<void>();
  @Output() moveIn = new EventEmitter<Room>();
  @Output() moveOut = new EventEmitter<{ room: Room; occupancy: Occupancy; resident: Resident }>();

  getOccupant(roomId: number): RoomOccupant | null {
    return this.occupantsMap.get(roomId) ?? null;
  }

  onRoomClick(room: Room): void {
    const occ = this.getOccupant(room.id!);
    if (occ) {
      this.moveOut.emit({ room, occupancy: occ.occupancy, resident: occ.resident });
    } else {
      this.moveIn.emit(room);
    }
  }
}
