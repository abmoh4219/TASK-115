import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

export type TrendDirection = 'up' | 'down' | 'flat';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="stat-card" [class.stat-card--clickable]="clickable">
      <!-- Icon -->
      <div class="stat-card__icon-wrap" [style.background]="iconBg">
        <mat-icon class="stat-card__icon" [style.color]="iconColor" aria-hidden="true">
          {{ icon }}
        </mat-icon>
      </div>

      <!-- Content -->
      <div class="stat-card__content">
        <p class="stat-card__label">{{ label }}</p>
        <p class="stat-card__value" [class.stat-card__value--loading]="loading">
          <span *ngIf="!loading">{{ value }}</span>
          <span *ngIf="loading" class="skeleton skeleton--value"></span>
        </p>

        <!-- Trend chip -->
        <div *ngIf="trend !== null && trend !== undefined && !loading" class="stat-card__trend stat-card__trend--{{ trendDirection }}">
          <mat-icon class="stat-card__trend-icon" aria-hidden="true">
            {{ trendDirection === 'up' ? 'trending_up' : trendDirection === 'down' ? 'trending_down' : 'trending_flat' }}
          </mat-icon>
          <span>{{ trendLabel }}</span>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./stat-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatCardComponent {
  @Input() icon = 'bar_chart';
  @Input() label = '';
  @Input() value: string | number = '-';
  @Input() loading = false;
  @Input() clickable = false;

  /** Numeric trend value. Positive = up, negative = down, 0 = flat. Pass null to hide. */
  @Input() trend: number | null = null;
  @Input() trendLabel = '';

  /** Optional icon background and color overrides */
  @Input() iconBg = '';
  @Input() iconColor = '';

  get trendDirection(): TrendDirection {
    if (this.trend === null) return 'flat';
    if (this.trend > 0) return 'up';
    if (this.trend < 0) return 'down';
    return 'flat';
  }
}
