import {
  Component, Input, forwardRef,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NG_VALUE_ACCESSOR, ControlValueAccessor } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-textarea',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  template: `
    <div class="hp-field" [class.hp-field--error]="errorMessage">
      <label *ngIf="label" class="hp-field__label" [class.hp-field__label--required]="required">
        {{ label }}
      </label>

      <div class="hp-field__control">
        <textarea
          class="hp-field__textarea"
          [placeholder]="placeholder"
          [disabled]="disabled"
          [readonly]="readonly"
          [rows]="rows"
          [attr.maxlength]="maxLength || null"
          [(ngModel)]="innerValue"
          (ngModelChange)="onValueChange($event)"
          (blur)="onTouched()"
          [attr.aria-invalid]="!!errorMessage"
        ></textarea>
      </div>

      <div class="hp-field__footer">
        <p *ngIf="hint && !errorMessage" class="hp-field__hint">{{ hint }}</p>
        <p *ngIf="errorMessage" class="hp-field__error" role="alert">
          <mat-icon>error_outline</mat-icon>{{ errorMessage }}
        </p>
        <span *ngIf="maxLength" class="hp-field__counter">
          {{ innerValue.length }}/{{ maxLength }}
        </span>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .hp-field { display: flex; flex-direction: column; gap: 0.375rem; }
    .hp-field__label {
      font-size: 0.8125rem; font-weight: 500; color: #374151;
      &--required::after { content: ' *'; color: #ef4444; }
    }
    .hp-field__textarea {
      width: 100%; padding: 0.625rem 0.875rem;
      border: 1px solid #e5e7eb; border-radius: 6px;
      font-size: 0.875rem; color: #111827; background: #ffffff;
      resize: vertical; outline: none; font-family: inherit; line-height: 1.5;
      transition: border-color 150ms, box-shadow 150ms;
      &::placeholder { color: #9ca3af; }
      &:focus { border-color: #1e3a5f; box-shadow: 0 0 0 3px rgba(30,58,95,0.1); }
      &:disabled { background: #f9fafb; color: #9ca3af; cursor: not-allowed; }
    }
    .hp-field--error .hp-field__textarea { border-color: #ef4444; }
    .hp-field__footer {
      display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem;
    }
    .hp-field__hint { font-size: 0.75rem; color: #6b7280; margin: 0; flex: 1; }
    .hp-field__error {
      font-size: 0.75rem; color: #ef4444; margin: 0; flex: 1;
      display: flex; align-items: center; gap: 0.25rem;
      mat-icon { font-size: 0.875rem; width: 0.875rem; height: 0.875rem; }
    }
    .hp-field__counter { font-size: 0.75rem; color: #9ca3af; white-space: nowrap; flex-shrink: 0; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => TextareaComponent),
    multi: true,
  }],
})
export class TextareaComponent implements ControlValueAccessor {
  @Input() label = '';
  @Input() placeholder = '';
  @Input() hint = '';
  @Input() errorMessage = '';
  @Input() rows = 4;
  @Input() maxLength = 0;
  @Input() disabled = false;
  @Input() readonly = false;
  @Input() required = false;

  innerValue = '';
  private onChange: (v: string) => void = () => {};
  onTouched: () => void = () => {};

  writeValue(val: string): void { this.innerValue = val ?? ''; }
  registerOnChange(fn: (v: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(d: boolean): void { this.disabled = d; }
  onValueChange(val: string): void { this.onChange(val); }
}
