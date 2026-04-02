import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type BadgeVariant = 'primary' | 'accent' | 'success' | 'warning' | 'danger' | 'neutral';

@Component({
  selector: 'app-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span *ngIf="count !== null" class="badge" [class]="'hp-badge hp-badge--' + variant">
      {{ count }}
    </span>
  `,
  styles: [`
    .badge {
      min-width: 20px;
      height: 20px;
      font-size: 0.7rem;
    }
  `],
})
export class BadgeComponent {
  @Input() count: number | null = null;
  @Input() variant: BadgeVariant = 'danger';
}
