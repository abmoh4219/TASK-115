import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserRole } from '../../../core/services/auth.service';

const ROLE_CONFIG: Record<UserRole, { label: string; bg: string; color: string }> = {
  admin:      { label: 'Admin',       bg: '#ede9fe', color: '#6d28d9' },
  resident:   { label: 'Resident',    bg: '#dbeafe', color: '#1d4ed8' },
  compliance: { label: 'Compliance',  bg: '#d1fae5', color: '#065f46' },
  analyst:    { label: 'Analyst',     bg: '#fef9c3', color: '#854d0e' },
};

@Component({
  selector: 'app-role-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span
      *ngIf="role"
      class="role-badge"
      [style.background]="config.bg"
      [style.color]="config.color"
      [attr.aria-label]="'Role: ' + config.label"
    >
      {{ config.label }}
    </span>
  `,
  styles: [`
    .role-badge {
      display: inline-block;
      padding: 0.125rem 0.625rem;
      border-radius: 20px;
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.02em;
      line-height: 1.6;
      white-space: nowrap;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RoleBadgeComponent {
  @Input() role: UserRole | null = null;

  get config() {
    return this.role ? ROLE_CONFIG[this.role] : { label: '', bg: '#f3f4f6', color: '#6b7280' };
  }
}
