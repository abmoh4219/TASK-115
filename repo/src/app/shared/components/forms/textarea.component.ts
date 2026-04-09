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
  styleUrls: ['./textarea.component.scss'],
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
