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
  styleUrls: ['./select.component.scss'],
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
