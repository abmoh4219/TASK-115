import {
  Component, Input, Output, EventEmitter, OnChanges, SimpleChanges,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';

import { ModalComponent } from '../../shared/components/modal/modal.component';
import { SelectComponent, SelectOption } from '../../shared/components/forms/select.component';
import { Room, Resident } from '../../core/services/db.service';
import { ReasonCode } from '../../core/services/property.service';

export interface MoveInPayload {
  residentId: number;
  reasonCode: string;
  effectiveFrom: Date;
  roomId?: number;
}

@Component({
  selector: 'app-move-in-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ModalComponent, SelectComponent],
  template: `
    <app-modal
      [open]="open"
      title="Move In Resident"
      confirmLabel="Confirm Move In"
      size="md"
      [loading]="saving"
      [confirmDisabled]="form.invalid || !form.get('residentId')?.value || (!room && !form.get('roomId')?.value)"
      (confirmed)="onConfirm()"
      (cancelled)="cancelled.emit()"
    >
      <div class="move-in-body" [formGroup]="form">

        <!-- Room info banner (when room is pre-selected) -->
        <div class="room-banner" *ngIf="room">
          <div class="room-banner__icon-wrap">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M19 9V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v3" stroke="#1e3a5f" stroke-width="2" stroke-linecap="round"/>
              <rect x="3" y="9" width="18" height="11" rx="2" stroke="#1e3a5f" stroke-width="2"/>
              <path d="M12 13v4m-2-2h4" stroke="#2dd4bf" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </div>
          <div>
            <p class="room-banner__label">Moving into</p>
            <p class="room-banner__value">Room {{ room.roomNumber }}&ensp;·&ensp;Capacity {{ room.capacity }}</p>
          </div>
        </div>

        <!-- Room selection (when no room is pre-selected) -->
        <div class="field-block" *ngIf="!room">
          <app-select
            label="Select Room"
            formControlName="roomId"
            placeholder="Choose a room..."
            [required]="true"
            [options]="roomOptions"
            [errorMessage]="form.get('roomId')?.touched && form.get('roomId')?.invalid ? 'Please select a room' : ''"
          ></app-select>
        </div>

        <!-- Resident select -->
        <div class="field-block">
          <app-select
            label="Select Resident"
            formControlName="residentId"
            placeholder="Choose a resident..."
            [required]="true"
            [options]="residentOptions"
            [errorMessage]="form.get('residentId')?.touched && form.get('residentId')?.invalid ? 'Please select a resident' : ''"
          ></app-select>

          <!-- Avatar preview for selected resident -->
          <div class="resident-preview" *ngIf="selectedResident">
            <div class="resident-avatar">
              {{ selectedResident.firstName[0] }}{{ selectedResident.lastName[0] }}
            </div>
            <div class="resident-preview__info">
              <p class="resident-preview__name">{{ selectedResident.firstName }} {{ selectedResident.lastName }}</p>
              <p class="resident-preview__sub">Active resident &middot; No current room assignment</p>
            </div>
          </div>

          <p class="no-residents" *ngIf="availableResidents.length === 0">
            No active residents without a current room assignment.
          </p>
        </div>

        <!-- Reason code -->
        <div class="field-block">
          <app-select
            label="Move-In Reason"
            formControlName="reasonCode"
            [required]="true"
            [options]="reasonCodeOptions"
          ></app-select>
        </div>

        <!-- Effective date -->
        <div class="field-block">
          <label class="field-label">Effective From <span class="req">*</span></label>
          <input
            class="date-input"
            type="date"
            formControlName="effectiveFrom"
          />
        </div>

      </div>
    </app-modal>
  `,
  styleUrls: ['./move-in-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MoveInModalComponent implements OnChanges {

  @Input() open = false;
  @Input() room: Room | null = null;
  @Input() availableRooms: Room[] = [];
  @Input() availableResidents: Resident[] = [];
  @Input() saving = false;

  @Output() confirmed = new EventEmitter<MoveInPayload>();
  @Output() cancelled = new EventEmitter<void>();

  form: FormGroup;

  readonly reasonCodeOptions: SelectOption[] = [
    { value: ReasonCode.MOVE_IN_NEW,     label: 'New Resident' },
    { value: ReasonCode.TRANSFER,        label: 'Transfer' },
    { value: ReasonCode.LEASE_START,     label: 'Lease Start' },
    { value: ReasonCode.ADMINISTRATIVE,  label: 'Administrative' },
  ];

  constructor(private fb: FormBuilder) {
    this.form = this.fb.group({
      residentId:   [null,                    Validators.required],
      roomId:       [null],
      reasonCode:   [ReasonCode.MOVE_IN_NEW,  Validators.required],
      effectiveFrom: [this.todayStr(),         Validators.required],
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && this.open) {
      this.form.reset({
        residentId:    null,
        roomId:        null,
        reasonCode:    ReasonCode.MOVE_IN_NEW,
        effectiveFrom: this.todayStr(),
      });
      // Require room selection when no room is pre-set
      const roomCtrl = this.form.get('roomId');
      if (!this.room) {
        roomCtrl?.setValidators(Validators.required);
      } else {
        roomCtrl?.clearValidators();
      }
      roomCtrl?.updateValueAndValidity();
    }
  }

  get roomOptions(): SelectOption[] {
    return this.availableRooms.map(r => ({
      value: r.id!,
      label: `Room ${r.roomNumber} (capacity ${r.capacity})`,
    }));
  }

  get residentOptions(): SelectOption[] {
    return this.availableResidents.map(r => ({
      value: r.id!,
      label: `${r.firstName} ${r.lastName}`,
    }));
  }

  get selectedResident(): Resident | null {
    const id = this.form.get('residentId')?.value;
    return id != null ? (this.availableResidents.find(r => r.id === Number(id)) ?? null) : null;
  }

  onConfirm(): void {
    if (this.form.invalid) return;
    const { residentId, roomId, reasonCode, effectiveFrom } = this.form.value;
    this.confirmed.emit({
      residentId:    Number(residentId),
      reasonCode:    reasonCode as string,
      effectiveFrom: new Date(effectiveFrom as string),
      roomId:        roomId ? Number(roomId) : undefined,
    });
  }

  private todayStr(): string {
    return new Date().toISOString().split('T')[0];
  }
}
