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
  styleUrls: ['./unit-drawer.component.scss'],
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
