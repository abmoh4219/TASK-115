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
  styleUrls: ['./empty-state.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmptyStateComponent {
  @Input() icon = 'inbox';
  @Input() title = 'Nothing here yet';
  @Input() description = '';
  @Input() compact = false;
}
