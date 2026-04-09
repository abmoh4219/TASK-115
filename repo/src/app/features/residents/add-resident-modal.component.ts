import {
  Component, Input, Output, EventEmitter, OnChanges, SimpleChanges,
  ChangeDetectionStrategy, ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';

import { ModalComponent } from '../../shared/components/modal/modal.component';
import { InputComponent } from '../../shared/components/forms/input.component';
import { SelectComponent, SelectOption } from '../../shared/components/forms/select.component';
import { CreateResidentData } from '../../core/services/resident.service';

// =====================================================
// AddResidentModalComponent
// =====================================================

@Component({
  selector: 'app-add-resident-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ModalComponent, InputComponent, SelectComponent],
  template: `
    <app-modal
      [open]="open"
      title="Add Resident"
      size="lg"
      confirmLabel="Add Resident"
      [loading]="saving"
      [confirmDisabled]="form.invalid"
      (confirmed)="onConfirm()"
      (cancelled)="cancelled.emit()"
    >
      <!-- Live avatar preview -->
      <div class="avatar-preview">
        <div class="avatar-circle" [style.background]="avatarBg">
          {{ avatarInitials }}
        </div>
        <p class="avatar-name">{{ avatarFullName || 'Enter name below' }}</p>
      </div>

      <form [formGroup]="form" class="resident-form" (ngSubmit)="onConfirm()">

        <!-- Two-column grid -->
        <div class="form-cols">

          <!-- Left: Personal Information -->
          <div class="form-col">
            <div class="section-divider">
              <span class="section-label">Personal Information</span>
            </div>

            <app-input
              label="First Name"
              formControlName="firstName"
              placeholder="Jane"
              [required]="true"
              [errorMessage]="err('firstName')"
            ></app-input>

            <app-input
              label="Last Name"
              formControlName="lastName"
              placeholder="Smith"
              [required]="true"
              [errorMessage]="err('lastName')"
            ></app-input>

            <div class="field-block">
              <label class="field-label">Date of Birth <span class="req">*</span></label>
              <input
                class="date-input"
                type="date"
                formControlName="dateOfBirth"
                [class.date-input--error]="err('dateOfBirth')"
              />
              <p *ngIf="err('dateOfBirth')" class="field-error">{{ err('dateOfBirth') }}</p>
            </div>

            <app-select
              label="Status"
              formControlName="status"
              [required]="true"
              [options]="statusOptions"
              [errorMessage]="err('status')"
            ></app-select>
          </div>

          <!-- Right: Contact Details -->
          <div class="form-col">
            <div class="section-divider">
              <span class="section-label">Contact Details</span>
            </div>

            <app-input
              label="Email Address"
              formControlName="email"
              type="email"
              placeholder="jane@example.com"
              [required]="true"
              [errorMessage]="err('email')"
            ></app-input>

            <app-input
              label="Phone Number"
              formControlName="phone"
              type="tel"
              placeholder="555-555-0100"
              [required]="true"
              [errorMessage]="err('phone')"
            ></app-input>
          </div>

        </div>
      </form>
    </app-modal>
  `,
  styleUrls: ['./add-resident-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddResidentModalComponent implements OnChanges {

  @Input() open   = false;
  @Input() saving = false;

  @Output() confirmed = new EventEmitter<CreateResidentData>();
  @Output() cancelled = new EventEmitter<void>();

  form: FormGroup;

  readonly statusOptions: SelectOption[] = [
    { value: 'active',   label: 'Active' },
    { value: 'pending',  label: 'Pending' },
    { value: 'inactive', label: 'Inactive' },
  ];

  private readonly AVATAR_COLORS = [
    '#1e3a5f', '#0d9488', '#7c3aed', '#db2777',
    '#ea580c', '#16a34a', '#2563eb', '#b45309',
  ];

  constructor(private fb: FormBuilder, private cdr: ChangeDetectorRef) {
    this.form = this.fb.group({
      firstName:   ['', [Validators.required, Validators.minLength(2)]],
      lastName:    ['', [Validators.required, Validators.minLength(2)]],
      dateOfBirth: ['', Validators.required],
      status:      ['active', Validators.required],
      email:       ['', [Validators.required, Validators.email]],
      phone:       ['', Validators.required],
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && this.open) {
      this.form.reset({ status: 'active' });
    }
  }

  // --------------------------------------------------
  // Avatar
  // --------------------------------------------------

  get avatarInitials(): string {
    const first = (this.form.get('firstName')?.value ?? '').trim();
    const last  = (this.form.get('lastName')?.value  ?? '').trim();
    if (!first && !last) return '?';
    return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase();
  }

  get avatarFullName(): string {
    const first = (this.form.get('firstName')?.value ?? '').trim();
    const last  = (this.form.get('lastName')?.value  ?? '').trim();
    return [first, last].filter(Boolean).join(' ');
  }

  get avatarBg(): string {
    const first = (this.form.get('firstName')?.value ?? '').trim();
    const last  = (this.form.get('lastName')?.value  ?? '').trim();
    const name  = `${first}${last}`;
    if (!name) return '#1e3a5f';
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = (hash * 31 + name.charCodeAt(i)) & 0xffffffff;
    }
    return this.AVATAR_COLORS[Math.abs(hash) % this.AVATAR_COLORS.length];
  }

  // --------------------------------------------------
  // Validation helpers
  // --------------------------------------------------

  err(field: string): string {
    const c = this.form.get(field);
    if (!c?.touched || !c.invalid) return '';
    if (c.errors?.['required'])   return 'This field is required';
    if (c.errors?.['minlength'])  return `Minimum ${c.errors['minlength'].requiredLength} characters`;
    if (c.errors?.['email'])      return 'Enter a valid email address';
    return 'Invalid value';
  }

  // --------------------------------------------------
  // Submit
  // --------------------------------------------------

  onConfirm(): void {
    this.form.markAllAsTouched();
    this.cdr.markForCheck();
    if (this.form.invalid) return;
    const v = this.form.value as {
      firstName: string; lastName: string;
      dateOfBirth: string; status: 'active' | 'inactive' | 'pending';
      email: string; phone: string;
    };
    this.confirmed.emit({
      firstName:   v.firstName.trim(),
      lastName:    v.lastName.trim(),
      email:       v.email.trim().toLowerCase(),
      phone:       v.phone.trim(),
      dateOfBirth: new Date(v.dateOfBirth),
      status:      v.status,
    });
  }
}
