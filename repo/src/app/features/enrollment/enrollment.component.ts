import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-enrollment',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="hp-page">
      <h1>Enrollment</h1>
      <div class="hp-card">
        <div class="hp-empty-state">
          <mat-icon class="hp-empty-icon">school</mat-icon>
          <h3>Enrollment</h3>
          <p>Phase 2+ — Coming Soon</p>
          <p>Course and service registration, waitlists, and enrollment history.</p>
        </div>
      </div>
    </div>
  `,
})
export class EnrollmentComponent {}
