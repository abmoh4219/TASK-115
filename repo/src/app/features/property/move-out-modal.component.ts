import {
  Component, Input, Output, EventEmitter, OnChanges, SimpleChanges,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';

import { ModalComponent } from '../../shared/components/modal/modal.component';
import { SelectComponent, SelectOption } from '../../shared/components/forms/select.component';
import { Room, Occupancy, Resident } from '../../core/services/db.service';
import { ReasonCode } from '../../core/services/property.service';

export interface MoveOutPayload {
  reasonCode: string;
  effectiveTo: Date;
}

@Component({
  selector: 'app-move-out-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ModalComponent, SelectComponent],
  template: `
    <app-modal
      [open]="open"
      title="Move Out Resident"
      confirmLabel="Confirm Move Out"
      size="sm"
      type="danger"
      [loading]="saving"
      [confirmDisabled]="form.invalid"
      (confirmed)="onConfirm()"
      (cancelled)="cancelled.emit()"
    >
      <div class="move-out-body" [formGroup]="form">

        <!-- Warning banner -->
        <div class="warning-banner">
          <svg class="warning-icon" width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
              stroke="#dc2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <p>This will end the resident's active room assignment. This action is logged in the audit trail.</p>
        </div>

        <!-- Current resident & room info -->
        <div class="resident-room-info" *ngIf="data">
          <div class="info-row">
            <div class="avatar">{{ data.resident.firstName[0] }}{{ data.resident.lastName[0] }}</div>
            <div>
              <p class="resident-name">{{ data.resident.firstName }} {{ data.resident.lastName }}</p>
              <p class="room-info">Room {{ data.room.roomNumber }}</p>
            </div>
          </div>
        </div>

        <!-- Reason code -->
        <app-select
          label="Move-Out Reason"
          formControlName="reasonCode"
          [required]="true"
          [options]="reasonCodeOptions"
        ></app-select>

        <!-- Effective date -->
        <div class="field-block">
          <label class="field-label">Effective Date <span class="req">*</span></label>
          <input
            class="date-input"
            type="date"
            formControlName="effectiveTo"
          />
        </div>

      </div>
    </app-modal>
  `,
  styles: [`
    :host { display: block; }

    .move-out-body {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      padding: 0.25rem 0;
    }

    .warning-banner {
      display: flex;
      align-items: flex-start;
      gap: 0.625rem;
      padding: 0.75rem;
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 8px;

      p {
        font-size: 0.8125rem;
        color: #7f1d1d;
        margin: 0;
        line-height: 1.5;
      }
    }

    .warning-icon { flex-shrink: 0; margin-top: 1px; }

    .resident-room-info {
      padding: 0.75rem;
      background: #f9fafb;
      border-radius: 8px;
    }

    .info-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .avatar {
      width: 40px; height: 40px;
      border-radius: 50%;
      background: #1e3a5f;
      color: #fff;
      display: flex; align-items: center; justify-content: center;
      font-size: 0.875rem;
      font-weight: 700;
      text-transform: uppercase;
      flex-shrink: 0;
    }

    .resident-name {
      font-size: 0.9375rem;
      font-weight: 600;
      color: #111827;
      margin: 0 0 0.125rem;
    }

    .room-info {
      font-size: 0.8125rem;
      color: #6b7280;
      margin: 0;
    }

    .field-block { display: flex; flex-direction: column; gap: 0.375rem; }

    .field-label {
      font-size: 0.8125rem;
      font-weight: 500;
      color: #374151;

      .req { color: #ef4444; margin-left: 2px; }
    }

    .date-input {
      height: 40px;
      width: 100%;
      padding: 0 0.875rem;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      font-size: 0.875rem;
      color: #111827;
      font-family: inherit;
      outline: none;
      transition: border-color 150ms, box-shadow 150ms;
      box-sizing: border-box;

      &:focus {
        border-color: #ef4444;
        box-shadow: 0 0 0 3px rgba(239,68,68,0.1);
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MoveOutModalComponent implements OnChanges {

  @Input() open = false;
  @Input() data: { room: Room; occupancy: Occupancy; resident: Resident } | null = null;
  @Input() saving = false;

  @Output() confirmed = new EventEmitter<MoveOutPayload>();
  @Output() cancelled = new EventEmitter<void>();

  form: FormGroup;

  readonly reasonCodeOptions: SelectOption[] = [
    { value: ReasonCode.MOVE_OUT_VOLUNTARY, label: 'Voluntary Departure' },
    { value: ReasonCode.MOVE_OUT_EVICTION,  label: 'Eviction' },
    { value: ReasonCode.LEASE_END,          label: 'Lease Ended' },
    { value: ReasonCode.ADMINISTRATIVE,     label: 'Administrative' },
  ];

  constructor(private fb: FormBuilder) {
    this.form = this.fb.group({
      reasonCode: [ReasonCode.MOVE_OUT_VOLUNTARY, Validators.required],
      effectiveTo: [this.todayStr(),              Validators.required],
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && this.open) {
      this.form.reset({
        reasonCode:  ReasonCode.MOVE_OUT_VOLUNTARY,
        effectiveTo: this.todayStr(),
      });
    }
  }

  onConfirm(): void {
    if (this.form.invalid) return;
    const { reasonCode, effectiveTo } = this.form.value;
    this.confirmed.emit({
      reasonCode:  reasonCode as string,
      effectiveTo: new Date(effectiveTo as string),
    });
  }

  private todayStr(): string {
    return new Date().toISOString().split('T')[0];
  }
}
