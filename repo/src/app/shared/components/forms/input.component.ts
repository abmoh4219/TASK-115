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
  styleUrls: ['./input.component.scss'],
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
