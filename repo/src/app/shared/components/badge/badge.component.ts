import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

export type BadgeColor = 'primary' | 'danger' | 'warning';

@Component({
  selector: 'app-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span
      *ngIf="count > 0"
      class="hp-unread-badge hp-unread-badge--{{ color }}"
      [attr.aria-label]="ariaLabel"
    >
      {{ displayCount }}
    </span>
  `,
  styles: [`
    :host { display: inline-flex; vertical-align: middle; }

    .hp-unread-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 20px;
      height: 20px;
      padding: 0 5px;
      border-radius: 10px;
      font-size: 0.6875rem;
      font-weight: 700;
      line-height: 1;
      font-family: inherit;
      letter-spacing: 0;

      &--primary { background: #1e3a5f; color: #ffffff; }
      &--danger  { background: #ef4444; color: #ffffff; }
      &--warning { background: #f59e0b; color: #ffffff; }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BadgeComponent {
  /** The count to display. Hidden when 0. */
  @Input() count = 0;
  /** Maximum value before showing "+". Defaults to 99. */
  @Input() max = 99;
  @Input() color: BadgeColor = 'danger';

  get displayCount(): string {
    return this.count > this.max ? `${this.max}+` : String(this.count);
  }

  get ariaLabel(): string {
    return this.count > this.max ? `More than ${this.max} unread` : `${this.count} unread`;
  }
}
