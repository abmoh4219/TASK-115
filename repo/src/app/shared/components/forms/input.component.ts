import {
  Component, Input, Output, EventEmitter, forwardRef,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NG_VALUE_ACCESSOR, ControlValueAccessor } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-input',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  template: `
    <div class="hp-field" [class.hp-field--error]="errorMessage" [class.hp-field--disabled]="disabled">
      <label *ngIf="label" class="hp-field__label" [class.hp-field__label--required]="required">
        {{ label }}
      </label>

      <div class="hp-field__control">
        <mat-icon *ngIf="prefixIcon" class="hp-field__icon hp-field__icon--prefix">{{ prefixIcon }}</mat-icon>

        <input
          class="hp-field__input"
          [class.hp-field__input--prefix]="prefixIcon"
          [class.hp-field__input--suffix]="suffixIcon || clearable"
          [type]="type"
          [placeholder]="placeholder"
          [disabled]="disabled"
          [readonly]="readonly"
          [attr.autocomplete]="autocomplete"
          [attr.aria-describedby]="errorMessage ? fieldId + '-error' : null"
          [attr.aria-invalid]="!!errorMessage"
          [(ngModel)]="innerValue"
          (ngModelChange)="onValueChange($event)"
          (blur)="onTouched()"
        />

        <button
          *ngIf="clearable && innerValue"
          class="hp-field__clear"
          type="button"
          (click)="clear()"
          aria-label="Clear field"
        >
          <mat-icon>close</mat-icon>
        </button>

        <mat-icon *ngIf="suffixIcon && !clearable" class="hp-field__icon hp-field__icon--suffix">{{ suffixIcon }}</mat-icon>
      </div>

      <p *ngIf="hint && !errorMessage" class="hp-field__hint">{{ hint }}</p>
      <p *ngIf="errorMessage" class="hp-field__error" [id]="fieldId + '-error'" role="alert">
        <mat-icon>error_outline</mat-icon>{{ errorMessage }}
      </p>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .hp-field {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
    }

    .hp-field__label {
      font-size: 0.8125rem;
      font-weight: 500;
      color: #374151;

      &--required::after { content: ' *'; color: #ef4444; }
    }

    .hp-field__control {
      position: relative;
      display: flex;
      align-items: center;
    }

    .hp-field__input {
      width: 100%;
      height: 40px;
      padding: 0 0.875rem;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      font-size: 0.875rem;
      color: #111827;
      background: #ffffff;
      transition: border-color 150ms, box-shadow 150ms;
      outline: none;
      font-family: inherit;

      &::placeholder { color: #9ca3af; }

      &:focus {
        border-color: #1e3a5f;
        box-shadow: 0 0 0 3px rgba(30, 58, 95, 0.1);
      }

      &:disabled { background: #f9fafb; color: #9ca3af; cursor: not-allowed; }
      &:read-only { background: #f9fafb; }

      &--prefix { padding-left: 2.5rem; }
      &--suffix { padding-right: 2.5rem; }
    }

    .hp-field--error .hp-field__input {
      border-color: #ef4444;
      &:focus { box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1); }
    }

    .hp-field__icon {
      position: absolute;
      font-size: 1rem;
      width: 1rem;
      height: 1rem;
      color: #9ca3af;
      pointer-events: none;

      &--prefix { left: 0.75rem; }
      &--suffix { right: 0.75rem; }
    }

    .hp-field__clear {
      position: absolute;
      right: 0.5rem;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      border: none;
      background: transparent;
      border-radius: 4px;
      cursor: pointer;
      color: #9ca3af;
      mat-icon { font-size: 1rem; width: 1rem; height: 1rem; }
      &:hover { color: #374151; background: #f3f4f6; }
    }

    .hp-field__hint {
      font-size: 0.75rem;
      color: #6b7280;
      margin: 0;
    }

    .hp-field__error {
      font-size: 0.75rem;
      color: #ef4444;
      margin: 0;
      display: flex;
      align-items: center;
      gap: 0.25rem;
      mat-icon { font-size: 0.875rem; width: 0.875rem; height: 0.875rem; }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => InputComponent),
    multi: true,
  }],
})
export class InputComponent implements ControlValueAccessor {
  @Input() label = '';
  @Input() type = 'text';
  @Input() placeholder = '';
  @Input() hint = '';
  @Input() errorMessage = '';
  @Input() prefixIcon = '';
  @Input() suffixIcon = '';
  @Input() clearable = false;
  @Input() disabled = false;
  @Input() readonly = false;
  @Input() required = false;
  @Input() autocomplete = '';

  fieldId = `hp-input-${Math.random().toString(36).slice(2, 7)}`;
  innerValue = '';

  private onChange: (v: string) => void = () => {};
  onTouched: () => void = () => {};

  writeValue(val: string): void { this.innerValue = val ?? ''; }
  registerOnChange(fn: (v: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(disabled: boolean): void { this.disabled = disabled; }

  onValueChange(val: string): void { this.onChange(val); }

  clear(): void {
    this.innerValue = '';
    this.onChange('');
  }
}
