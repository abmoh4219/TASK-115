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
  styles: [`
    :host { display: block; }

    .stat-card {
      display: flex;
      align-items: flex-start;
      gap: 1rem;
      padding: 1.25rem;
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);

      &--clickable {
        cursor: pointer;
        transition: box-shadow 150ms, transform 150ms;
        &:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.1); transform: translateY(-1px); }
      }
    }

    .stat-card__icon-wrap {
      width: 48px; height: 48px; border-radius: 10px;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      background: rgba(30, 58, 95, 0.08);
    }

    .stat-card__icon {
      font-size: 1.5rem; width: 1.5rem; height: 1.5rem; color: #1e3a5f;
    }

    .stat-card__content { flex: 1; min-width: 0; }

    .stat-card__label {
      font-size: 0.75rem; font-weight: 500; color: #6b7280;
      text-transform: uppercase; letter-spacing: 0.04em; margin: 0 0 0.25rem;
    }

    .stat-card__value {
      font-size: 1.75rem; font-weight: 700; color: #111827;
      margin: 0 0 0.375rem; line-height: 1.2;
    }

    .skeleton--value {
      display: block; width: 80px; height: 28px; border-radius: 4px;
      background: linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
    }

    @keyframes shimmer {
      0%   { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    .stat-card__trend {
      display: inline-flex; align-items: center; gap: 0.25rem;
      padding: 0.125rem 0.5rem; border-radius: 20px;
      font-size: 0.75rem; font-weight: 600;

      &--up   { background: #dcfce7; color: #16a34a; }
      &--down { background: #fee2e2; color: #dc2626; }
      &--flat { background: #f3f4f6; color: #6b7280; }
    }

    .stat-card__trend-icon {
      font-size: 0.875rem; width: 0.875rem; height: 0.875rem;
    }
  `],
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
