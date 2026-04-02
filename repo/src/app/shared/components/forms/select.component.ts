import {
  Component, Input, Output, EventEmitter, forwardRef,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NG_VALUE_ACCESSOR, ControlValueAccessor } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

@Component({
  selector: 'app-select',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  template: `
    <div class="hp-field" [class.hp-field--error]="errorMessage" [class.hp-field--disabled]="disabled">
      <label *ngIf="label" class="hp-field__label" [class.hp-field__label--required]="required">
        {{ label }}
      </label>

      <div class="hp-field__control">
        <select
          class="hp-field__select"
          [disabled]="disabled"
          [(ngModel)]="innerValue"
          (ngModelChange)="onValueChange($event)"
          (blur)="onTouched()"
          [attr.aria-invalid]="!!errorMessage"
        >
          <option *ngIf="placeholder" value="" disabled>{{ placeholder }}</option>
          <option
            *ngFor="let opt of options"
            [value]="opt.value"
            [disabled]="opt.disabled"
          >{{ opt.label }}</option>
        </select>
        <mat-icon class="hp-field__chevron" aria-hidden="true">expand_more</mat-icon>
      </div>

      <p *ngIf="hint && !errorMessage" class="hp-field__hint">{{ hint }}</p>
      <p *ngIf="errorMessage" class="hp-field__error" role="alert">
        <mat-icon>error_outline</mat-icon>{{ errorMessage }}
      </p>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .hp-field { display: flex; flex-direction: column; gap: 0.375rem; }
    .hp-field__label {
      font-size: 0.8125rem; font-weight: 500; color: #374151;
      &--required::after { content: ' *'; color: #ef4444; }
    }
    .hp-field__control { position: relative; }
    .hp-field__select {
      width: 100%; height: 40px; padding: 0 2.25rem 0 0.875rem;
      border: 1px solid #e5e7eb; border-radius: 6px;
      font-size: 0.875rem; color: #111827; background: #ffffff;
      appearance: none; cursor: pointer; outline: none; font-family: inherit;
      transition: border-color 150ms, box-shadow 150ms;
      &:focus { border-color: #1e3a5f; box-shadow: 0 0 0 3px rgba(30,58,95,0.1); }
      &:disabled { background: #f9fafb; color: #9ca3af; cursor: not-allowed; }
    }
    .hp-field--error .hp-field__select { border-color: #ef4444; }
    .hp-field__chevron {
      position: absolute; right: 0.625rem; top: 50%; transform: translateY(-50%);
      font-size: 1.125rem; width: 1.125rem; height: 1.125rem;
      color: #6b7280; pointer-events: none;
    }
    .hp-field__hint { font-size: 0.75rem; color: #6b7280; margin: 0; }
    .hp-field__error {
      font-size: 0.75rem; color: #ef4444; margin: 0;
      display: flex; align-items: center; gap: 0.25rem;
      mat-icon { font-size: 0.875rem; width: 0.875rem; height: 0.875rem; }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => SelectComponent),
    multi: true,
  }],
})
export class SelectComponent implements ControlValueAccessor {
  @Input() label = '';
  @Input() options: SelectOption[] = [];
  @Input() placeholder = '';
  @Input() hint = '';
  @Input() errorMessage = '';
  @Input() disabled = false;
  @Input() required = false;

  innerValue: string | number = '';

  private onChange: (v: string | number) => void = () => {};
  onTouched: () => void = () => {};

  writeValue(val: string | number): void { this.innerValue = val ?? ''; }
  registerOnChange(fn: (v: string | number) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(disabled: boolean): void { this.disabled = disabled; }
  onValueChange(val: string | number): void { this.onChange(val); }
}
