import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="empty-state" [class.empty-state--compact]="compact">
      <div class="empty-state__icon-wrap">
        <mat-icon class="empty-state__icon" aria-hidden="true">{{ icon }}</mat-icon>
      </div>
      <h3 class="empty-state__title">{{ title }}</h3>
      <p *ngIf="description" class="empty-state__desc">{{ description }}</p>
      <div class="empty-state__action">
        <ng-content></ng-content>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 4rem 2rem;
      text-align: center;

      &--compact {
        padding: 2rem 1rem;
        .empty-state__icon { font-size: 2.5rem; width: 2.5rem; height: 2.5rem; }
        .empty-state__title { font-size: 0.9375rem; }
      }
    }

    .empty-state__icon-wrap {
      width: 80px; height: 80px; border-radius: 50%;
      background: #f1f5f9;
      display: flex; align-items: center; justify-content: center;
      margin-bottom: 1.25rem;
    }

    .empty-state__icon {
      font-size: 3rem; width: 3rem; height: 3rem; color: #cbd5e1;
    }

    .empty-state__title {
      font-size: 1.0625rem; font-weight: 600; color: #374151; margin: 0 0 0.5rem;
    }

    .empty-state__desc {
      font-size: 0.875rem; color: #6b7280; margin: 0 0 1.5rem;
      max-width: 360px; line-height: 1.6;
    }

    .empty-state__action:empty { display: none; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmptyStateComponent {
  @Input() icon = 'inbox';
  @Input() title = 'Nothing here yet';
  @Input() description = '';
  @Input() compact = false;
}
