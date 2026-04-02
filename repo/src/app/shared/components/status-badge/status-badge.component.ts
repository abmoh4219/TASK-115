import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

export type StatusVariant =
  | 'active' | 'inactive' | 'pending'
  | 'approved' | 'rejected' | 'pending_review'
  | 'enrolled' | 'waitlisted' | 'dropped' | 'completed'
  | 'open' | 'closed' | 'cancelled'
  | 'success' | 'warning' | 'error' | 'neutral';

interface StatusConfig {
  label: string;
  bg: string;
  color: string;
  dot: string;
}

const STATUS_MAP: Record<string, StatusConfig> = {
  active:         { label: 'Active',          bg: '#dcfce7', color: '#166534', dot: '#16a34a' },
  inactive:       { label: 'Inactive',        bg: '#f3f4f6', color: '#4b5563', dot: '#9ca3af' },
  pending:        { label: 'Pending',         bg: '#fef9c3', color: '#854d0e', dot: '#d97706' },
  approved:       { label: 'Approved',        bg: '#dcfce7', color: '#166534', dot: '#16a34a' },
  rejected:       { label: 'Rejected',        bg: '#fee2e2', color: '#991b1b', dot: '#ef4444' },
  pending_review: { label: 'Pending Review',  bg: '#fef9c3', color: '#854d0e', dot: '#d97706' },
  enrolled:       { label: 'Enrolled',        bg: '#dbeafe', color: '#1e40af', dot: '#2563eb' },
  waitlisted:     { label: 'Waitlisted',      bg: '#fef3c7', color: '#92400e', dot: '#d97706' },
  dropped:        { label: 'Dropped',         bg: '#fee2e2', color: '#991b1b', dot: '#ef4444' },
  completed:      { label: 'Completed',       bg: '#dcfce7', color: '#166534', dot: '#16a34a' },
  open:           { label: 'Open',            bg: '#dcfce7', color: '#166534', dot: '#16a34a' },
  closed:         { label: 'Closed',          bg: '#f3f4f6', color: '#4b5563', dot: '#9ca3af' },
  cancelled:      { label: 'Cancelled',       bg: '#fee2e2', color: '#991b1b', dot: '#ef4444' },
  success:        { label: 'Success',         bg: '#dcfce7', color: '#166534', dot: '#16a34a' },
  warning:        { label: 'Warning',         bg: '#fef9c3', color: '#854d0e', dot: '#d97706' },
  error:          { label: 'Error',           bg: '#fee2e2', color: '#991b1b', dot: '#ef4444' },
  neutral:        { label: 'Neutral',         bg: '#f3f4f6', color: '#4b5563', dot: '#9ca3af' },
};

const FALLBACK: StatusConfig = { label: 'Unknown', bg: '#f3f4f6', color: '#6b7280', dot: '#9ca3af' };

@Component({
  selector: 'app-status-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span
      class="status-badge"
      [style.background]="config.bg"
      [style.color]="config.color"
    >
      <span class="status-badge__dot" [style.background]="config.dot"></span>
      {{ labelOverride || config.label }}
    </span>
  `,
  styles: [`
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.125rem 0.625rem;
      border-radius: 20px;
      font-size: 0.75rem;
      font-weight: 600;
      line-height: 1.6;
      white-space: nowrap;
    }
    .status-badge__dot {
      width: 6px; height: 6px;
      border-radius: 50%; flex-shrink: 0;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusBadgeComponent {
  @Input() status: string = 'neutral';
  /** Override the display label (uses status key label if not set). */
  @Input() labelOverride = '';

  get config(): StatusConfig {
    return STATUS_MAP[this.status] ?? FALLBACK;
  }
}
