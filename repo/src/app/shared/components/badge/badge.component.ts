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
  styleUrls: ['./badge.component.scss'],
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
