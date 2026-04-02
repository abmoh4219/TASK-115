import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-audit-log',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="hp-page">
      <h1>Audit Log</h1>
      <div class="hp-card">
        <div class="hp-empty-state">
          <mat-icon class="hp-empty-icon">history</mat-icon>
          <h3>Audit Log</h3>
          <p>Phase 2+ — Coming Soon</p>
          <p>Immutable record of all admin actions, rule changes, and anomalies.</p>
        </div>
      </div>
    </div>
  `,
})
export class AuditLogComponent {}
